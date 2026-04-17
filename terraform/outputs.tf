# Terraform Outputs

# Resource Group
output "resource_group_name" {
  description = "Resource group name"
  value       = azurerm_resource_group.main.name
}

# Networking
output "vnet_id" {
  description = "Virtual network ID"
  value       = module.networking.vnet_id
}

output "private_subnet_id" {
  description = "Private subnet ID"
  value       = module.networking.subnet_ids["private"]
}

# AKS
output "aks_cluster_name" {
  description = "AKS cluster name"
  value       = module.aks.cluster_name
}

output "aks_cluster_id" {
  description = "AKS cluster ID"
  value       = module.aks.cluster_id
}

output "aks_oidc_issuer_url" {
  description = "AKS OIDC issuer URL"
  value       = module.aks.oidc_issuer_url
}

# Storage
output "acr_name" {
  description = "Azure Container Registry name"
  value       = module.storage.acr_name
}

output "acr_login_server" {
  description = "ACR login server"
  value       = module.storage.acr_login_server
}

output "key_vault_name" {
  description = "Key Vault name"
  value       = module.storage.key_vault_name
}

output "key_vault_url" {
  description = "Key Vault URL"
  value       = module.storage.key_vault_url
}

# Database
output "postgresql_fqdn" {
  description = "PostgreSQL server FQDN"
  value       = module.database.server_fqdn
}

output "postgresql_name" {
  description = "PostgreSQL server name"
  value       = module.database.server_name
}

# Cognitive Services (Azure OpenAI)
output "openai_endpoint" {
  description = "Azure OpenAI endpoint URL"
  value       = module.cognitive_services.openai_endpoint
}

output "openai_primary_key" {
  description = "Azure OpenAI primary key"
  value       = module.cognitive_services.openai_primary_key
  sensitive   = true
}

output "gpt4_deployment_name" {
  description = "GPT-4 deployment name"
  value       = module.cognitive_services.gpt4_deployment_name
}

output "gpt35_deployment_name" {
  description = "GPT-3.5 deployment name"
  value       = module.cognitive_services.gpt35_deployment_name
}

# Identities
output "workload_identity_client_id" {
  description = "Workload identity client ID for Kubernetes pods"
  value       = module.identities.workload_identity_client_id
}

output "runner_identity_client_id" {
  description = "Runner identity client ID"
  value       = module.identities.runner_identity_client_id
}

output "runner_identity_principal_id" {
  description = "Runner identity principal ID"
  value       = module.identities.runner_identity_principal_id
}

# Compute
output "runner_public_ip" {
  description = "Runner VM public IP"
  value       = module.compute.runner_public_ip
}

output "runner_ssh_private_key" {
  description = "Runner SSH private key"
  value       = module.compute.runner_ssh_private_key
  sensitive   = true
}
