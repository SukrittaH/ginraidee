# Azure Key Vault for centralized secrets management
resource "azurerm_key_vault" "project_kv" {
  name                = "${var.projectname}-${var.environment}-${var.location-abbreviation}-kv"
  location            = var.location
  resource_group_name = azurerm_resource_group.project_rg.name
  tenant_id           = var.tenant_id
  sku_name            = "standard"

  # Use Azure RBAC for access control (modern approach, replaces access policies)
  rbac_authorization_enabled = true

  # Security features
  enabled_for_deployment          = false
  enabled_for_disk_encryption     = false
  enabled_for_template_deployment = false
  soft_delete_retention_days      = 7
  purge_protection_enabled        = false  # Set to true in production

  # Network rules - allow access from AKS and runner VM
  network_acls {
    bypass                     = "AzureServices"
    default_action             = "Deny"
    ip_rules                   = []
    virtual_network_subnet_ids = [
      azurerm_subnet.project_snet["private"].id,    # AKS subnet
      azurerm_subnet.project_snet["public"].id      # Runner VM subnet
    ]
  }

  tags = {
    Environment = var.environment
    Project     = var.projectname
    ManagedBy   = "Terraform"
  }
}

# Link PostgreSQL private DNS zone to AKS VNET
# This allows pods in AKS to resolve the PostgreSQL FQDN
resource "azurerm_private_dns_zone_virtual_network_link" "postgres_to_aks_vnet" {
  name                  = "${var.projectname}-${var.environment}-postgres-to-aks-link"
  resource_group_name   = azurerm_resource_group.project_rg.name
  private_dns_zone_name = azurerm_private_dns_zone.postgres_pdns.name
  virtual_network_id    = azurerm_virtual_network.project_vnet.id
  registration_enabled  = false

  tags = {
    Environment = var.environment
    Project     = var.projectname
  }
}
