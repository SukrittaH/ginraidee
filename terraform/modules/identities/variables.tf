variable "project_name" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment (dev/prod)"
  type        = string
}

variable "location" {
  description = "Azure region"
  type        = string
}

variable "location_abbreviation" {
  description = "Location abbreviation"
  type        = string
}

variable "resource_group_name" {
  description = "Resource group name"
  type        = string
}

variable "resource_group_id" {
  description = "Resource group ID"
  type        = string
}

variable "key_vault_id" {
  description = "Key Vault ID for RBAC assignments"
  type        = string
}

variable "aks_cluster_id" {
  description = "AKS cluster ID for RBAC assignments"
  type        = string
}

variable "aks_oidc_issuer_url" {
  description = "AKS OIDC issuer URL for federated credentials"
  type        = string
}

variable "kubernetes_namespace" {
  description = "Kubernetes namespace for service accounts"
  type        = string
  default     = "ginraidee"
}

variable "service_names" {
  description = "List of service names for federated credentials"
  type        = list(string)
  default     = ["auth-service", "inventory-service", "ocr-service", "recipe-service"]
}

variable "enable_runner" {
  description = "Enable runner VM identity"
  type        = bool
  default     = true
}

variable "tags" {
  description = "Resource tags"
  type        = map(string)
  default     = {}
}
