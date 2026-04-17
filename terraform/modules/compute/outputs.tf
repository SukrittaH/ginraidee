output "runner_public_ip" {
  description = "Runner VM public IP"
  value       = azurerm_public_ip.runner.ip_address
}

output "runner_ssh_private_key" {
  description = "Runner SSH private key"
  value       = tls_private_key.runner_ssh.private_key_pem
  sensitive   = true
}

output "runner_vm_id" {
  description = "Runner VM ID"
  value       = azurerm_linux_virtual_machine.runner.id
}
