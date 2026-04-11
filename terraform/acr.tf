# Azure Container Registry for Docker images
resource "azurerm_container_registry" "project_acr" {
  name                = "${var.projectname}${var.environment}acr"  # No hyphens - ACR naming requirement
  location            = var.location
  resource_group_name = azurerm_resource_group.project_rg.name
  sku                 = var.environment == "prod" ? "Standard" : "Basic"
  admin_enabled       = false  # Use managed identity instead of admin credentials

  # Enable anonymous pull for public images (optional - set to false for private only)
  anonymous_pull_enabled = false

  # Zone redundancy (only available in Premium SKU)
  # zone_redundancy_enabled = false

  tags = {
    Environment = var.environment
    Project     = var.projectname
    ManagedBy   = "Terraform"
  }
}

# Grant AKS kubelet identity permission to pull images from ACR
resource "azurerm_role_assignment" "aks_acr_pull" {
  principal_id                     = azurerm_kubernetes_cluster.aks_cluster.kubelet_identity[0].object_id
  role_definition_name             = "AcrPull"
  scope                            = azurerm_container_registry.project_acr.id
  skip_service_principal_aad_check = true
}
