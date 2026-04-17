output "openai_id" {
  description = "Azure OpenAI resource ID"
  value       = azurerm_cognitive_account.openai.id
}

output "openai_endpoint" {
  description = "Azure OpenAI endpoint URL"
  value       = azurerm_cognitive_account.openai.endpoint
}

output "openai_primary_key" {
  description = "Azure OpenAI primary access key"
  value       = azurerm_cognitive_account.openai.primary_access_key
  sensitive   = true
}

output "openai_name" {
  description = "Azure OpenAI account name"
  value       = azurerm_cognitive_account.openai.name
}

output "gpt4_deployment_name" {
  description = "GPT-4 deployment name"
  value       = azurerm_cognitive_deployment.gpt4.name
}

output "gpt35_deployment_name" {
  description = "GPT-3.5 deployment name (if enabled)"
  value       = var.enable_gpt35 ? azurerm_cognitive_deployment.gpt35[0].name : null
}
