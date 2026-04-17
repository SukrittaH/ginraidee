# Managed Identities Module

# Workload Identity for Kubernetes pods
resource "azurerm_user_assigned_identity" "workload" {
  name                = "${var.project_name}-${var.environment}-${var.location_abbreviation}-workload-identity"
  location            = var.location
  resource_group_name = var.resource_group_name

  tags = var.tags
}

# Grant workload identity Key Vault Secrets User role
resource "azurerm_role_assignment" "workload_kv_secrets_user" {
  principal_id         = azurerm_user_assigned_identity.workload.principal_id
  role_definition_name = "Key Vault Secrets User"
  scope                = var.key_vault_id
}

# Federated identity credentials for each microservice
resource "azurerm_federated_identity_credential" "services" {
  for_each = toset(var.service_names)

  name                = "${each.key}-federated"
  resource_group_name = var.resource_group_name
  parent_id           = azurerm_user_assigned_identity.workload.id
  audience            = ["api://AzureADTokenExchange"]
  issuer              = var.aks_oidc_issuer_url
  subject             = "system:serviceaccount:${var.kubernetes_namespace}:${each.key}-sa"
}

# Runner Identity (if enabled)
resource "azurerm_user_assigned_identity" "runner" {
  count = var.enable_runner ? 1 : 0

  name                = "${var.project_name}-${var.environment}-${var.location_abbreviation}-runner-identity"
  location            = var.location
  resource_group_name = var.resource_group_name

  tags = var.tags
}

# Runner identity permissions
resource "azurerm_role_assignment" "runner_kv_secrets_officer" {
  count = var.enable_runner ? 1 : 0

  principal_id         = azurerm_user_assigned_identity.runner[0].principal_id
  role_definition_name = "Key Vault Secrets Officer"
  scope                = var.key_vault_id
}

resource "azurerm_role_assignment" "runner_aks_admin" {
  count = var.enable_runner ? 1 : 0

  principal_id         = azurerm_user_assigned_identity.runner[0].principal_id
  role_definition_name = "Azure Kubernetes Service RBAC Cluster Admin"
  scope                = var.aks_cluster_id
}

resource "azurerm_role_assignment" "runner_rg_contributor" {
  count = var.enable_runner ? 1 : 0

  principal_id         = azurerm_user_assigned_identity.runner[0].principal_id
  role_definition_name = "Contributor"
  scope                = var.resource_group_id
}
