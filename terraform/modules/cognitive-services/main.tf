# Azure OpenAI Service Module

resource "azurerm_cognitive_account" "openai" {
  name                  = "${var.project_name}-${var.environment}-${var.location_abbreviation}-openai"
  location              = var.location
  resource_group_name   = var.resource_group_name
  kind                  = "OpenAI"
  sku_name              = var.sku_name
  custom_subdomain_name = "${var.project_name}-${var.environment}-${var.location_abbreviation}-openai"

  public_network_access_enabled = var.public_network_access_enabled

  network_acls {
    default_action = var.network_acls_default_action
    ip_rules       = var.allowed_ip_ranges

    dynamic "virtual_network_rules" {
      for_each = var.allowed_subnet_ids
      content {
        subnet_id = virtual_network_rules.value
      }
    }
  }

  identity {
    type = "SystemAssigned"
  }

  tags = var.tags
}

# GPT-4 Deployment for Recipe Service
resource "azurerm_cognitive_deployment" "gpt4" {
  name                 = var.gpt4_deployment_name
  cognitive_account_id = azurerm_cognitive_account.openai.id

  model {
    format  = "OpenAI"
    name    = var.gpt4_model_name
    version = var.gpt4_model_version
  }

  sku {
    name     = "Standard"
    capacity = var.gpt4_capacity
  }
}

# Optional: GPT-3.5 for cost-effective operations
resource "azurerm_cognitive_deployment" "gpt35" {
  count                = var.enable_gpt35 ? 1 : 0
  name                 = var.gpt35_deployment_name
  cognitive_account_id = azurerm_cognitive_account.openai.id

  model {
    format  = "OpenAI"
    name    = var.gpt35_model_name
    version = var.gpt35_model_version
  }

  sku {
    name     = "Standard"
    capacity = var.gpt35_capacity
  }
}
