terraform {
  required_providers {
    azurerm = {
      source = "hashicorp/azurerm"
      version = "4.58.0"
    }
    azuread = {
      source = "hashicorp/azuread"
      version = "3.7.0"
    }
  }
}

provider "azurerm" {
  features {}
 # use_msi = true
  subscription_id = var.subscription_id
}

provider "azuread" {
  tenant_id       = var.tenant_id       
}