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

variable "public_subnet_id" {
  description = "Public subnet ID for runner VM"
  type        = string
}

variable "vm_size" {
  description = "VM size for runner"
  type        = string
  default     = "Standard_D2s_v3"
}

variable "runner_identity_id" {
  description = "Runner managed identity ID"
  type        = string
}

variable "tags" {
  description = "Resource tags"
  type        = map(string)
  default     = {}
}
