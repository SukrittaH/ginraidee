# GitHub Self-Hosted Runner VM
# This VM will run GitHub Actions workflows for deploying to AKS

# Generate SSH Key for Runner VM
resource "tls_private_key" "runner_ssh_key" {
  algorithm = "RSA"
  rsa_bits  = 4096
}

# User-assigned managed identity for the runner VM
resource "azurerm_user_assigned_identity" "runner_identity" {
  name                = "${var.projectname}-${var.environment}-${var.location-abbreviation}-runner-identity"
  location            = var.location
  resource_group_name = azurerm_resource_group.project_rg.name

  tags = {
    Environment = var.environment
    Project     = var.projectname
    ManagedBy   = "Terraform"
  }
}

# Grant runner VM identity "Key Vault Secrets Officer" role for seeding secrets
resource "azurerm_role_assignment" "runner_kv_secrets_officer" {
  principal_id         = azurerm_user_assigned_identity.runner_identity.principal_id
  role_definition_name = "Key Vault Secrets Officer"
  scope                = azurerm_key_vault.project_kv.id
}

# Grant runner VM identity "AKS Cluster User" role for kubectl access
resource "azurerm_role_assignment" "runner_aks_user" {
  principal_id         = azurerm_user_assigned_identity.runner_identity.principal_id
  role_definition_name = "Azure Kubernetes Service Cluster User Role"
  scope                = azurerm_kubernetes_cluster.aks_cluster.id
}

# Grant runner VM identity "Contributor" role on resource group for deployment
resource "azurerm_role_assignment" "runner_rg_contributor" {
  principal_id         = azurerm_user_assigned_identity.runner_identity.principal_id
  role_definition_name = "Contributor"
  scope                = azurerm_resource_group.project_rg.id
}

# Cloud-init configuration for runner VM
locals {
  custom_data_runner = <<-EOF
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

# Public IP for runner VM
resource "azurerm_public_ip" "runner_pip" {
  name                = "${var.projectname}-${var.environment}-${var.location-abbreviation}-runner-pip"
  location            = var.location
  resource_group_name = azurerm_resource_group.project_rg.name
  allocation_method   = "Static"
  sku                 = "Standard"

  tags = {
    Environment = var.environment
    Project     = var.projectname
  }
}

# Network interface for runner VM
resource "azurerm_network_interface" "runner_nic" {
  name                = "${var.projectname}-${var.environment}-${var.location-abbreviation}-runner-nic"
  location            = var.location
  resource_group_name = azurerm_resource_group.project_rg.name

  ip_configuration {
    name                          = "runner-ip-config"
    subnet_id                     = azurerm_subnet.project_snet["public"].id
    private_ip_address_allocation = "Dynamic"
    public_ip_address_id          = azurerm_public_ip.runner_pip.id
  }

  tags = {
    Environment = var.environment
    Project     = var.projectname
  }
}

# Network security group for runner VM
resource "azurerm_network_security_group" "runner_nsg" {
  name                = "${var.projectname}-${var.environment}-${var.location-abbreviation}-runner-nsg"
  location            = var.location
  resource_group_name = azurerm_resource_group.project_rg.name

  # Allow SSH from anywhere (consider restricting to your IP in production)
  security_rule {
    name                       = "AllowSSH"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "22"
    source_address_prefix      = "*"  # Consider restricting this in production
    destination_address_prefix = "*"
  }

  # Allow outbound internet access for GitHub and Azure
  security_rule {
    name                       = "AllowInternet"
    priority                   = 100
    direction                  = "Outbound"
    access                     = "Allow"
    protocol                   = "*"
    source_port_range          = "*"
    destination_port_range     = "*"
    source_address_prefix      = "*"
    destination_address_prefix = "Internet"
  }

  tags = {
    Environment = var.environment
    Project     = var.projectname
  }
}

# Associate NSG with network interface
resource "azurerm_network_interface_security_group_association" "runner_nic_nsg_assoc" {
  network_interface_id      = azurerm_network_interface.runner_nic.id
  network_security_group_id = azurerm_network_security_group.runner_nsg.id
}

# Linux VM for GitHub runner
resource "azurerm_linux_virtual_machine" "runner_vm" {
  name                            = "${var.projectname}-${var.environment}-${var.location-abbreviation}-runner-vm"
  location                        = var.location
  resource_group_name             = azurerm_resource_group.project_rg.name
  size                            = var.runner_vm_size
  admin_username                  = "azureuser"
  disable_password_authentication = true

  admin_ssh_key {
    username   = "azureuser"
    public_key = tls_private_key.runner_ssh_key.public_key_openssh
  }

  network_interface_ids = [azurerm_network_interface.runner_nic.id]

  # Attach managed identity
  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.runner_identity.id]
  }

  os_disk {
    name                 = "${var.projectname}-${var.environment}-runner-osdisk"
    caching              = "ReadWrite"
    storage_account_type = "Standard_LRS"
    disk_size_gb         = 128
  }

  source_image_reference {
    publisher = "Canonical"
    offer     = "0001-com-ubuntu-server-jammy"
    sku       = "22_04-lts"
    version   = "latest"
  }

  custom_data = base64encode(local.custom_data_runner)

  tags = {
    Environment = var.environment
    Project     = var.projectname
    Role        = "GitHub-Runner"
  }
}

# Outputs for runner VM
output "runner_public_ip" {
  description = "Public IP address of the runner VM"
  value       = azurerm_public_ip.runner_pip.ip_address
}

output "runner_ssh_command" {
  description = "SSH command to connect to the runner VM"
  value       = "ssh -i <private_key_file> azureuser@${azurerm_public_ip.runner_pip.ip_address}"
}

output "runner_ssh_private_key" {
  description = "Private SSH key to connect to the runner VM (save securely)"
  value       = tls_private_key.runner_ssh_key.private_key_pem
  sensitive   = true
}

output "runner_identity_principal_id" {
  description = "Principal ID of the runner VM's managed identity"
  value       = azurerm_user_assigned_identity.runner_identity.principal_id
}
