# Storage Module - ACR and Key Vault

# Azure Container Registry
resource "azurerm_container_registry" "main" {
  name                = "${var.project_name}${var.environment}${var.location_abbreviation}acr"
  location            = var.location
  resource_group_name = var.resource_group_name
  sku                 = var.acr_sku
  admin_enabled       = false

  tags = var.tags
}

# Azure Key Vault
resource "azurerm_key_vault" "main" {
  name                = "${var.project_name}-${var.environment}-${var.location_abbreviation}-kv"
  location            = var.location
  resource_group_name = var.resource_group_name
  tenant_id           = var.tenant_id
  sku_name            = "standard"

  # Use Azure RBAC for access control
  rbac_authorization_enabled = true

  # Security features
  enabled_for_deployment          = false
  enabled_for_disk_encryption     = false
  enabled_for_template_deployment = false
  soft_delete_retention_days      = 7
  purge_protection_enabled        = false

  # Network ACLs
  network_acls {
    bypass         = "AzureServices"
    default_action = "Deny"
    ip_rules       = var.key_vault_allowed_ips

    virtual_network_subnet_ids = concat(
      var.allowed_subnet_ids,
      var.runner_subnet_id != null ? [var.runner_subnet_id] : []
    )
  }

  tags = var.tags
}
