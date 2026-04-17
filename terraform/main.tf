# Main Terraform Configuration - Modular Structure

terraform {
  required_version = ">= 1.0"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }
}

provider "azurerm" {
  features {
    key_vault {
      purge_soft_delete_on_destroy = true
    }
  }
  subscription_id = var.subscription_id
}

# Resource Group
resource "azurerm_resource_group" "main" {
  name     = "${var.projectname}-${var.environment}-${var.location-abbreviation}-rg"
  location = var.location

  tags = local.common_tags
}

# Local variables
locals {
  common_tags = {
    Environment = var.environment
    Project     = var.projectname
    ManagedBy   = "Terraform"
  }
}

# Networking Module
module "networking" {
  source = "./modules/networking"

  project_name          = var.projectname
  environment           = var.environment
  location              = var.location
  location_abbreviation = var.location-abbreviation
  resource_group_name   = azurerm_resource_group.main.name
  vnet_address_space    = var.vnet_address_space
  subnet_details        = var.subnet_details
  tags                  = local.common_tags
}

# Storage Module (ACR + Key Vault)
module "storage" {
  source = "./modules/storage"

  project_name          = var.projectname
  environment           = var.environment
  location              = var.location
  location_abbreviation = var.location-abbreviation
  resource_group_name   = azurerm_resource_group.main.name
  tenant_id             = var.tenant_id
  acr_sku               = var.environment == "prod" ? "Standard" : "Basic"
  allowed_subnet_ids = [
    module.networking.subnet_ids["private"],
    module.networking.subnet_ids["public"]
  ]
  tags = local.common_tags
}

# AKS Module
module "aks" {
  source = "./modules/aks"

  project_name          = var.projectname
  environment           = var.environment
  location              = var.location
  location_abbreviation = var.location-abbreviation
  resource_group_name   = azurerm_resource_group.main.name
  tenant_id             = var.tenant_id
  vm_size               = var.vm_size
  os_disk_size_gb       = var.os_disk_size_gb
  private_subnet_id     = module.networking.subnet_ids["private"]
  service_cidr          = var.service_cidr
  dns_service_ip        = var.dns_service_ip
  pod_cidr              = var.pod_cidr
  acr_id                = module.storage.acr_id
  tags                  = local.common_tags

  depends_on = [module.storage]
}

# Database Module
module "database" {
  source = "./modules/database"

  project_name          = var.projectname
  environment           = var.environment
  location              = var.location
  location_abbreviation = var.location-abbreviation
  resource_group_name   = azurerm_resource_group.main.name
  tenant_id             = var.tenant_id
  admin_username        = var.postgresql_admin_username
  admin_password        = var.postgresql_admin_password
  sku_name              = var.postgresql_size
  delegated_subnet_id   = module.networking.subnet_ids["postgresql"]
  private_dns_zone_id   = module.networking.private_dns_zone_id
  tags                  = local.common_tags

  depends_on = [module.networking]
}

# Cognitive Services Module (Azure OpenAI)
module "cognitive_services" {
  source = "./modules/cognitive-services"

  project_name          = var.projectname
  environment           = var.environment
  location              = var.openai_location
  location_abbreviation = var.openai_location_abbreviation
  resource_group_name   = azurerm_resource_group.main.name
  allowed_subnet_ids = [
    module.networking.subnet_ids["private"]
  ]
  gpt4_deployment_name = "gpt-4"
  gpt4_model_name      = "gpt-4"
  gpt4_model_version   = "0613"
  gpt4_capacity        = 10
  enable_gpt35         = true
  tags                 = local.common_tags
}

# Identities Module
module "identities" {
  source = "./modules/identities"

  project_name          = var.projectname
  environment           = var.environment
  location              = var.location
  location_abbreviation = var.location-abbreviation
  resource_group_name   = azurerm_resource_group.main.name
  resource_group_id     = azurerm_resource_group.main.id
  key_vault_id          = module.storage.key_vault_id
  aks_cluster_id        = module.aks.cluster_id
  aks_oidc_issuer_url   = module.aks.oidc_issuer_url
  enable_runner         = true
  tags                  = local.common_tags

  depends_on = [module.storage, module.aks]
}

# Compute Module (Runner VM)
module "compute" {
  source = "./modules/compute"

  project_name          = var.projectname
  environment           = var.environment
  location              = var.location
  location_abbreviation = var.location-abbreviation
  resource_group_name   = azurerm_resource_group.main.name
  public_subnet_id      = module.networking.subnet_ids["public"]
  vm_size               = var.runner_vm_size
  runner_identity_id    = module.identities.runner_identity_id
  tags                  = local.common_tags

  depends_on = [module.identities]
}
