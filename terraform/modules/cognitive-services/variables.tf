variable "project_name" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment (dev/prod)"
  type        = string
}

variable "location" {
  description = "Azure region for OpenAI (limited availability)"
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

variable "sku_name" {
  description = "SKU name for OpenAI (S0 standard)"
  type        = string
  default     = "S0"
}

variable "public_network_access_enabled" {
  description = "Enable public network access"
  type        = bool
  default     = true
}

variable "network_acls_default_action" {
  description = "Default network ACL action"
  type        = string
  default     = "Allow"
}

variable "allowed_ip_ranges" {
  description = "Allowed IP ranges for OpenAI access"
  type        = list(string)
  default     = []
}

variable "allowed_subnet_ids" {
  description = "Allowed subnet IDs for OpenAI access"
  type        = list(string)
  default     = []
}

variable "gpt4_deployment_name" {
  description = "Deployment name for GPT-4"
  type        = string
  default     = "gpt-4"
}

variable "gpt4_model_name" {
  description = "Model name for GPT-4"
  type        = string
  default     = "gpt-4"
}

variable "gpt4_model_version" {
  description = "Model version for GPT-4"
  type        = string
  default     = "0613"
}

variable "gpt4_capacity" {
  description = "Capacity (TPM in thousands) for GPT-4"
  type        = number
  default     = 10
}

variable "enable_gpt35" {
  description = "Enable GPT-3.5 Turbo deployment"
  type        = bool
  default     = false
}

variable "gpt35_deployment_name" {
  description = "Deployment name for GPT-3.5"
  type        = string
  default     = "gpt-35-turbo"
}

variable "gpt35_model_name" {
  description = "Model name for GPT-3.5"
  type        = string
  default     = "gpt-35-turbo"
}

variable "gpt35_model_version" {
  description = "Model version for GPT-3.5"
  type        = string
  default     = "0613"
}

variable "gpt35_capacity" {
  description = "Capacity (TPM in thousands) for GPT-3.5"
  type        = number
  default     = 10
}

variable "tags" {
  description = "Resource tags"
  type        = map(string)
  default     = {}
}
