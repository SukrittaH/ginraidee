resource "azurerm_resource_group" "project_rg" {
  name     = "${var.projectname}-${var.environment}-${var.location-abbreviation}-rg"
  location = var.location
}

resource "azurerm_virtual_network" "project_vnet" {
  name = "${var.projectname}-${var.environment}-${var.location-abbreviation}-vnet"
  location            = var.location
  resource_group_name = azurerm_resource_group.project_rg.name
  address_space       = var.vnet_address_space
}

resource "azurerm_subnet" "project_snet" {
  for_each             = var.subnet_details
   name                 = each.key
  resource_group_name  = azurerm_resource_group.project_rg.name
  virtual_network_name = azurerm_virtual_network.project_vnet.name
  address_prefixes     = each.value
  service_endpoints    = each.key == "enterprise" ? ["Microsoft.Storage", "Microsoft.KeyVault", "Microsoft.CognitiveServices"] : []

  dynamic "delegation" {
    for_each = each.key == "postgresql" ? [1] : [] 
    content {
      name = "postgresql-delegation"

      service_delegation {
        name = "Microsoft.DBforPostgreSQL/flexibleServers"
        actions = [
          "Microsoft.Network/virtualNetworks/subnets/join/action"
        ]
      }
    }
  }
}

resource "azurerm_kubernetes_cluster" "aks_cluster" {
  name                = "${var.projectname}-${var.environment}-${var.location-abbreviation}-aks"
  location            = var.location
  resource_group_name = azurerm_resource_group.project_rg.name
  dns_prefix          = "${var.projectname}-aks"
  local_account_disabled = true
  role_based_access_control_enabled = true

  # Enable Azure AD Integration with Azure RBAC
  azure_active_directory_role_based_access_control {
    tenant_id              = var.tenant_id  
    azure_rbac_enabled     = true  # Enable Azure RBAC based on Azure AD
  }

  private_cluster_enabled = false
  private_cluster_public_fqdn_enabled = false
  oidc_issuer_enabled = true
  workload_identity_enabled = true
  image_cleaner_enabled = true
  image_cleaner_interval_hours = 240
  node_os_upgrade_channel = "NodeImage"
  automatic_upgrade_channel = "node-image"
  key_vault_secrets_provider {
    secret_rotation_enabled = true
  }

default_node_pool {
  name                = "agentpool"
  node_count          = 1
  vm_size             = var.vm_size
  vnet_subnet_id      = azurerm_subnet.project_snet["private"].id
  os_disk_size_gb     = var.os_disk_size_gb
  type                = "VirtualMachineScaleSets"
  auto_scaling_enabled = true
  min_count           = 1
  max_count           = 3
  max_pods            = 110
  orchestrator_version = "1.33.0"
}

  network_profile {
    network_plugin    = "azure"
    network_plugin_mode = "overlay"
    load_balancer_sku = "standard"
    outbound_type     = "loadBalancer"
    service_cidr        = var.service_cidr      # Separate range for Kubernetes services
    dns_service_ip      = var.dns_service_ip    # IP within the `service_cidr` range for DNS
    pod_cidr            = var.pod_cidr   
    load_balancer_profile {
      managed_outbound_ip_count = 1
      backend_pool_type = "NodeIPConfiguration"
    }   
  }

  # identity {
  #   type = "SystemAssigned"
  # }

   identity {
     type = "SystemAssigned"
     #identity_ids = [azurerm_user_assigned_identity.aks_identity.id]
       } 
}

resource "azurerm_kubernetes_cluster_node_pool" "userpool" {
  name                  = "userpool"
  kubernetes_cluster_id = azurerm_kubernetes_cluster.aks_cluster.id
  vm_size               = "Standard_D2as_v5"
  node_count            = 1
  vnet_subnet_id        = azurerm_subnet.project_snet["private"].id
  os_disk_size_gb       = 128
  min_count             = null
  max_count             = null
  max_pods              = 30
  mode                  = "User"
  orchestrator_version  = "1.33.0"
}

output "aks_cluster_name" {
  value = azurerm_kubernetes_cluster.aks_cluster.name
}

resource "azurerm_private_dns_zone" "postgres_pdns" {
  name                = "privatelink.postgres.database.azure.com"
  resource_group_name = azurerm_resource_group.project_rg.name
}

resource "azurerm_postgresql_flexible_server" "postgresql_db" {
  #count = var.environment == "prod" ? 1 : 0

  name                   = "${var.projectname}-${var.environment}-${var.location-abbreviation}-pgsql"
  location               = var.location
  resource_group_name    = azurerm_resource_group.project_rg.name
  administrator_login    = "${var.postgresql_admin_username}"
  administrator_password = "${var.postgresql_admin_password}"
  sku_name               = "${var.postgresql_size}"
  version                = "16"
  storage_mb             = 32768
  backup_retention_days  = 7
  delegated_subnet_id    = azurerm_subnet.project_snet["postgresql"].id
  private_dns_zone_id    = azurerm_private_dns_zone.postgres_pdns.id
  public_network_access_enabled = false
  
  // Enable Azure AD Authentication
  authentication {
    active_directory_auth_enabled = true
    password_auth_enabled         = true
    tenant_id                     = "${var.tenant_id}"
  }
}

/*
# Generate SSH Key for App Runner VM
resource "tls_private_key" "runner_ssh_key" {
  algorithm = "RSA"
  rsa_bits  = 4096
}

# App-host Runner VM
locals {
  custom_data_runner = <<EOF
#cloud-config
package_update: true
package_upgrade: true
packages:
  - curl
  - vim
  - iputils-ping
  - dnsutils
  - swaks
  - postgresql-client
  - tcpdump
  - telnet
  - apt-transport-https
  - lsb-release
  - ca-certificates
  - unzip

runcmd:
  # Setup Docker engine
  - curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  - chmod a+r /etc/apt/keyrings/docker.asc
  - echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$${UBUNTU_CODENAME:-$VERSION_CODENAME}") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
  - apt-get update
  - apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  - groupadd docker || true
  - usermod -aG docker azureuser
  
  # Setup Azure CLI and AZCOPY
  - curl -sL https://aka.ms/InstallAzureCLIDeb | bash
  - az aks install-cli
  - bash -c '. /etc/os-release && curl -sSL -O https://packages.microsoft.com/config/$ID/$VERSION_ID/packages-microsoft-prod.deb'
  - dpkg -i packages-microsoft-prod.deb
  - rm packages-microsoft-prod.deb
  - apt-get update
  - apt-get install -y azcopy
  
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
EOF
}

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
}

resource "azurerm_network_security_group" "runner_nsg" {
  name                = "${var.projectname}-${var.environment}-${var.location-abbreviation}-runner-nsg"
  location            = var.location
  resource_group_name  = azurerm_resource_group.project_rg.name

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
}

resource "azurerm_network_interface_security_group_association" "runner_nic_nsg_assoc" {
  network_interface_id      = azurerm_network_interface.runner_nic.id
  network_security_group_id = azurerm_network_security_group.runner_nsg.id
}


resource "azurerm_linux_virtual_machine" "app_runner" {
  name                = "${var.projectname}-${var.environment}-${var.location-abbreviation}-runner-vm"
  location            = var.location
  resource_group_name = azurerm_resource_group.project_rg.name
  size                = var.runner_vm_size
  admin_username      = "azureadmin"
  disable_password_authentication = true

  admin_ssh_key {
    username   = "azureadmin"
    public_key = tls_private_key.runner_ssh_key.public_key_openssh
  }

  network_interface_ids = [azurerm_network_interface.runner_nic.id]

  os_disk {
    caching              = "ReadWrite"
    storage_account_type = "Standard_LRS"
  }

  source_image_reference {
    publisher = "Canonical"
    offer     = "0001-com-ubuntu-server-jammy"
    sku       = "22_04-lts"
    version   = "latest"
  }

  custom_data = base64encode(local.custom_data_runner)
}

resource "azurerm_public_ip" "runner_pip" {
  name                = "${var.projectname}-${var.environment}-${var.location-abbreviation}-runner-pip"
  location            = var.location
  resource_group_name = azurerm_resource_group.project_rg.name
  allocation_method   = "Static"
}

# Output the private key for SSH access (save this securely)
output "runner_ssh_private_key" {
  description = "Private SSH key to connect to the runner VM"
  value       = tls_private_key.runner_ssh_key.private_key_pem
  sensitive   = true
}

# Output the public IP for easy SSH access
output "runner_public_ip" {
  description = "Public IP address of the runner VM"
  value       = azurerm_public_ip.runner_pip.ip_address
}

# Output SSH command for easy access
output "runner_ssh_command" {
  description = "SSH command to connect to the runner VM"
  value       = "ssh -i <private_key_file> azureadmin@${azurerm_public_ip.runner_pip.ip_address}"
}
*/