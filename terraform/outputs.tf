# AKS Outputs
output "aks_cluster_name" {
  description = "Name of the AKS cluster"
  value       = azurerm_kubernetes_cluster.aks_cluster.name
}

output "aks_cluster_id" {
  description = "ID of the AKS cluster"
  value       = azurerm_kubernetes_cluster.aks_cluster.id
}

output "aks_oidc_issuer_url" {
  description = "OIDC issuer URL for workload identity"
  value       = azurerm_kubernetes_cluster.aks_cluster.oidc_issuer_url
}

# Key Vault Outputs
output "key_vault_name" {
  description = "Name of the Azure Key Vault"
  value       = azurerm_key_vault.project_kv.name
}

output "key_vault_url" {
  description = "URL of the Azure Key Vault"
  value       = azurerm_key_vault.project_kv.vault_uri
}

output "key_vault_id" {
  description = "ID of the Azure Key Vault"
  value       = azurerm_key_vault.project_kv.id
}

# ACR Outputs
output "acr_name" {
  description = "Name of the Azure Container Registry"
  value       = azurerm_container_registry.project_acr.name
}

output "acr_login_server" {
  description = "Login server URL for ACR"
  value       = azurerm_container_registry.project_acr.login_server
}

output "acr_id" {
  description = "ID of the Azure Container Registry"
  value       = azurerm_container_registry.project_acr.id
}

# Workload Identity Outputs
output "workload_identity_client_id" {
  description = "Client ID of the workload identity (use this in Helm values)"
  value       = azurerm_user_assigned_identity.workload_identity.client_id
}

output "workload_identity_principal_id" {
  description = "Principal ID of the workload identity"
  value       = azurerm_user_assigned_identity.workload_identity.principal_id
}

output "workload_identity_name" {
  description = "Name of the workload identity"
  value       = azurerm_user_assigned_identity.workload_identity.name
}

# PostgreSQL Outputs
output "postgresql_fqdn" {
  description = "FQDN of the PostgreSQL server"
  value       = azurerm_postgresql_flexible_server.postgresql_db.fqdn
}

output "postgresql_name" {
  description = "Name of the PostgreSQL server"
  value       = azurerm_postgresql_flexible_server.postgresql_db.name
}

# Resource Group Output
output "resource_group_name" {
  description = "Name of the resource group"
  value       = azurerm_resource_group.project_rg.name
}

# Network Outputs
output "vnet_id" {
  description = "ID of the Virtual Network"
  value       = azurerm_virtual_network.project_vnet.id
}

output "private_subnet_id" {
  description = "ID of the private subnet (AKS nodes)"
  value       = azurerm_subnet.project_snet["private"].id
}
