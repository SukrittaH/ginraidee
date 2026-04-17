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

variable "tenant_id" {
  description = "Azure tenant ID"
  type        = string
}

variable "admin_username" {
  description = "PostgreSQL administrator username"
  type        = string
}

variable "admin_password" {
  description = "PostgreSQL administrator password"
  type        = string
  sensitive   = true
}

variable "sku_name" {
  description = "PostgreSQL SKU name"
  type        = string
}

variable "postgres_version" {
  description = "PostgreSQL version"
  type        = string
  default     = "16"
}

variable "storage_mb" {
  description = "Storage size in MB"
  type        = number
  default     = 32768
}

variable "backup_retention_days" {
  description = "Backup retention in days"
  type        = number
  default     = 7
}

variable "delegated_subnet_id" {
  description = "Subnet ID for PostgreSQL delegation"
  type        = string
}

variable "private_dns_zone_id" {
  description = "Private DNS zone ID for PostgreSQL"
  type        = string
}

variable "database_name" {
  description = "Database name"
  type        = string
  default     = "ginraidee"
}

variable "tags" {
  description = "Resource tags"
  type        = map(string)
  default     = {}
}
