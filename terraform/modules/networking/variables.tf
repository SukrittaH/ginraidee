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

variable "vnet_address_space" {
  description = "Virtual network address space"
  type        = list(string)
}

variable "subnet_details" {
  description = "Subnet configuration"
  type        = map(list(string))
}

variable "tags" {
  description = "Resource tags"
  type        = map(string)
  default     = {}
}
