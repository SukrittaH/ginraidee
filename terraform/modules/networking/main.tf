# Virtual Network and Subnets Module

resource "azurerm_virtual_network" "main" {
  name                = "${var.project_name}-${var.environment}-${var.location_abbreviation}-vnet"
  location            = var.location
  resource_group_name = var.resource_group_name
  address_space       = var.vnet_address_space

  tags = var.tags
}

resource "azurerm_subnet" "subnets" {
  for_each             = var.subnet_details
  name                 = each.key
  resource_group_name  = var.resource_group_name
  virtual_network_name = azurerm_virtual_network.main.name
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

resource "azurerm_private_dns_zone" "postgres" {
  name                = "privatelink.postgres.database.azure.com"
  resource_group_name = var.resource_group_name

  tags = var.tags
}

resource "azurerm_private_dns_zone_virtual_network_link" "postgres_vnet_link" {
  name                  = "postgres-vnet-link"
  resource_group_name   = var.resource_group_name
  private_dns_zone_name = azurerm_private_dns_zone.postgres.name
  virtual_network_id    = azurerm_virtual_network.main.id

  tags = var.tags
}
