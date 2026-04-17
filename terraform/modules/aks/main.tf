# Azure Kubernetes Service Module

resource "azurerm_kubernetes_cluster" "main" {
  name                = "${var.project_name}-${var.environment}-${var.location_abbreviation}-aks"
  location            = var.location
  resource_group_name = var.resource_group_name
  dns_prefix          = "${var.project_name}-aks"

  local_account_disabled             = true
  role_based_access_control_enabled  = true
  private_cluster_enabled            = false
  private_cluster_public_fqdn_enabled = false
  oidc_issuer_enabled                = true
  workload_identity_enabled          = true
  image_cleaner_enabled              = true
  image_cleaner_interval_hours       = 240
  node_os_upgrade_channel            = "NodeImage"
  automatic_upgrade_channel          = "node-image"

  # Enable Azure AD Integration with Azure RBAC
  azure_active_directory_role_based_access_control {
    tenant_id          = var.tenant_id
    azure_rbac_enabled = true
  }

  # Enable Key Vault Secrets Provider
  key_vault_secrets_provider {
    secret_rotation_enabled = true
  }

  default_node_pool {
    name                 = "agentpool"
    node_count           = var.default_node_pool_count
    vm_size              = var.vm_size
    vnet_subnet_id       = var.private_subnet_id
    os_disk_size_gb      = var.os_disk_size_gb
    type                 = "VirtualMachineScaleSets"
    auto_scaling_enabled = true
    min_count            = var.default_node_pool_min_count
    max_count            = var.default_node_pool_max_count
    max_pods             = 110
    orchestrator_version = var.kubernetes_version
  }

  network_profile {
    network_plugin      = "azure"
    network_plugin_mode = "overlay"
    load_balancer_sku   = "standard"
    outbound_type       = "loadBalancer"
    service_cidr        = var.service_cidr
    dns_service_ip      = var.dns_service_ip
    pod_cidr            = var.pod_cidr

    load_balancer_profile {
      managed_outbound_ip_count = 1
      backend_pool_type         = "NodeIPConfiguration"
    }
  }

  identity {
    type = "SystemAssigned"
  }

  tags = var.tags
}

resource "azurerm_kubernetes_cluster_node_pool" "user" {
  name                  = "userpool"
  kubernetes_cluster_id = azurerm_kubernetes_cluster.main.id
  vm_size               = var.vm_size
  node_count            = var.user_node_pool_count
  vnet_subnet_id        = var.private_subnet_id
  os_disk_size_gb       = var.os_disk_size_gb
  min_count             = null
  max_count             = null
  max_pods              = 30
  mode                  = "User"
  orchestrator_version  = var.kubernetes_version

  tags = var.tags
}

# Grant AKS kubelet identity ACR pull permission
resource "azurerm_role_assignment" "aks_acr_pull" {
  principal_id         = azurerm_kubernetes_cluster.main.kubelet_identity[0].object_id
  role_definition_name = "AcrPull"
  scope                = var.acr_id
}
