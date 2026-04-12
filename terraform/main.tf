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
  service_endpoints    = contains(["enterprise", "private", "public"], each.key) ? ["Microsoft.Storage", "Microsoft.KeyVault", "Microsoft.CognitiveServices"] : []

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
  vm_size               = "Standard_D2s_v3"
  node_count            = 1
  vnet_subnet_id        = azurerm_subnet.project_snet["private"].id
  os_disk_size_gb       = 128
  min_count             = null
  max_count             = null
  max_pods              = 30
  mode                  = "User"
  orchestrator_version  = "1.33.0"
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

# Runner VM configuration moved to runner.tf