output "workload_identity_id" {
  description = "Workload identity ID"
  value       = azurerm_user_assigned_identity.workload.id
}

output "workload_identity_client_id" {
  description = "Workload identity client ID"
  value       = azurerm_user_assigned_identity.workload.client_id
}

output "workload_identity_principal_id" {
  description = "Workload identity principal ID"
  value       = azurerm_user_assigned_identity.workload.principal_id
}

output "runner_identity_id" {
  description = "Runner identity ID"
  value       = var.enable_runner ? azurerm_user_assigned_identity.runner[0].id : null
}

output "runner_identity_client_id" {
  description = "Runner identity client ID"
  value       = var.enable_runner ? azurerm_user_assigned_identity.runner[0].client_id : null
}

output "runner_identity_principal_id" {
  description = "Runner identity principal ID"
  value       = var.enable_runner ? azurerm_user_assigned_identity.runner[0].principal_id : null
}
