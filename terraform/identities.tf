# User-assigned managed identity for workload identity
# This identity will be used by pods to access Azure Key Vault
resource "azurerm_user_assigned_identity" "workload_identity" {
  name                = "${var.projectname}-${var.environment}-${var.location-abbreviation}-workload-identity"
  location            = var.location
  resource_group_name = azurerm_resource_group.project_rg.name

  tags = {
    Environment = var.environment
    Project     = var.projectname
    ManagedBy   = "Terraform"
  }
}

# Grant workload identity "Key Vault Secrets User" role to read secrets
resource "azurerm_role_assignment" "workload_identity_kv_secrets_user" {
  principal_id         = azurerm_user_assigned_identity.workload_identity.principal_id
  role_definition_name = "Key Vault Secrets User"
  scope                = azurerm_key_vault.project_kv.id
}

# Federated identity credentials for each microservice
# These link Kubernetes service accounts to the Azure managed identity

# Auth Service
resource "azurerm_federated_identity_credential" "auth_service" {
  name                = "auth-service-federated"
  resource_group_name = azurerm_resource_group.project_rg.name
  parent_id           = azurerm_user_assigned_identity.workload_identity.id
  audience            = ["api://AzureADTokenExchange"]
  issuer              = azurerm_kubernetes_cluster.aks_cluster.oidc_issuer_url
  subject             = "system:serviceaccount:ginraidee:auth-service-sa"
}

# Inventory Service
resource "azurerm_federated_identity_credential" "inventory_service" {
  name                = "inventory-service-federated"
  resource_group_name = azurerm_resource_group.project_rg.name
  parent_id           = azurerm_user_assigned_identity.workload_identity.id
  audience            = ["api://AzureADTokenExchange"]
  issuer              = azurerm_kubernetes_cluster.aks_cluster.oidc_issuer_url
  subject             = "system:serviceaccount:ginraidee:inventory-service-sa"
}

# OCR Service
resource "azurerm_federated_identity_credential" "ocr_service" {
  name                = "ocr-service-federated"
  resource_group_name = azurerm_resource_group.project_rg.name
  parent_id           = azurerm_user_assigned_identity.workload_identity.id
  audience            = ["api://AzureADTokenExchange"]
  issuer              = azurerm_kubernetes_cluster.aks_cluster.oidc_issuer_url
  subject             = "system:serviceaccount:ginraidee:ocr-service-sa"
}

# Recipe Service
resource "azurerm_federated_identity_credential" "recipe_service" {
  name                = "recipe-service-federated"
  resource_group_name = azurerm_resource_group.project_rg.name
  parent_id           = azurerm_user_assigned_identity.workload_identity.id
  audience            = ["api://AzureADTokenExchange"]
  issuer              = azurerm_kubernetes_cluster.aks_cluster.oidc_issuer_url
  subject             = "system:serviceaccount:ginraidee:recipe-service-sa"
}
