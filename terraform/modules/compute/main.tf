# Compute Module - GitHub Runner VM

# SSH Key for Runner VM
resource "tls_private_key" "runner_ssh" {
  algorithm = "RSA"
  rsa_bits  = 4096
}

# Cloud-init configuration
locals {
  custom_data = <<-EOF
    #cloud-config
    package_update: true
    package_upgrade: true
    packages:
      - curl
      - vim
      - iputils-ping
      - dnsutils
      - postgresql-client
      - apt-transport-https
      - lsb-release
      - ca-certificates
      - unzip
      - jq
      - netcat

    runcmd:
      # Setup Docker engine
      - curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
      - chmod a+r /etc/apt/keyrings/docker.asc
      - echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$${UBUNTU_CODENAME:-$VERSION_CODENAME}") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
      - apt-get update
      - apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
      - groupadd docker || true
      - usermod -aG docker azureuser

      # Setup Azure CLI
      - curl -sL https://aka.ms/InstallAzureCLIDeb | bash
      - az aks install-cli

      # Setup GitHub Runner Material
      - mkdir -p /home/azureuser/actions-runner
      - cd /home/azureuser/actions-runner && curl -o actions-runner-linux-x64-2.324.0.tar.gz -L https://github.com/actions/runner/releases/download/v2.324.0/actions-runner-linux-x64-2.324.0.tar.gz
      - cd /home/azureuser/actions-runner && tar xzf ./actions-runner-linux-x64-2.324.0.tar.gz
      - chown -R azureuser:azureuser /home/azureuser/actions-runner

      # Setup Helm
      - curl -fsSL -o /tmp/get_helm.sh https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3
      - chmod 700 /tmp/get_helm.sh
      - /tmp/get_helm.sh

      # Setup yq
      - snap install yq

      # Setup Trivy for image scanning
      - wget -qO - https://aquasecurity.github.io/trivy-repo/deb/public.key | apt-key add -
      - echo "deb https://aquasecurity.github.io/trivy-repo/deb $(lsb_release -sc) main" | tee -a /etc/apt/sources.list.d/trivy.list
      - apt-get update
      - apt-get install -y trivy
  EOF
}

# Public IP
resource "azurerm_public_ip" "runner" {
  name                = "${var.project_name}-${var.environment}-${var.location_abbreviation}-runner-pip"
  location            = var.location
  resource_group_name = var.resource_group_name
  allocation_method   = "Static"
  sku                 = "Standard"

  tags = var.tags
}

# Network Interface
resource "azurerm_network_interface" "runner" {
  name                = "${var.project_name}-${var.environment}-${var.location_abbreviation}-runner-nic"
  location            = var.location
  resource_group_name = var.resource_group_name

  ip_configuration {
    name                          = "runner-ip-config"
    subnet_id                     = var.public_subnet_id
    private_ip_address_allocation = "Dynamic"
    public_ip_address_id          = azurerm_public_ip.runner.id
  }

  tags = var.tags
}

# Network Security Group
resource "azurerm_network_security_group" "runner" {
  name                = "${var.project_name}-${var.environment}-${var.location_abbreviation}-runner-nsg"
  location            = var.location
  resource_group_name = var.resource_group_name

  security_rule {
    name                       = "AllowSSH"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "22"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }

  tags = var.tags
}

resource "azurerm_network_interface_security_group_association" "runner" {
  network_interface_id      = azurerm_network_interface.runner.id
  network_security_group_id = azurerm_network_security_group.runner.id
}

# Linux Virtual Machine
resource "azurerm_linux_virtual_machine" "runner" {
  name                            = "${var.project_name}-${var.environment}-${var.location_abbreviation}-runner-vm"
  location                        = var.location
  resource_group_name             = var.resource_group_name
  size                            = var.vm_size
  admin_username                  = "azureuser"
  disable_password_authentication = true
  network_interface_ids           = [azurerm_network_interface.runner.id]
  custom_data                     = base64encode(local.custom_data)

  admin_ssh_key {
    username   = "azureuser"
    public_key = tls_private_key.runner_ssh.public_key_openssh
  }

  os_disk {
    caching              = "ReadWrite"
    storage_account_type = "Standard_LRS"
    disk_size_gb         = 128
  }

  source_image_reference {
    publisher = "Canonical"
    offer     = "0001-com-ubuntu-server-jammy"
    sku       = "22_04-lts-gen2"
    version   = "latest"
  }

  identity {
    type         = "UserAssigned"
    identity_ids = [var.runner_identity_id]
  }

  tags = var.tags
}
