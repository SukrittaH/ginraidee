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

variable "vm_size" {
  description = "VM size for AKS nodes"
  type        = string
}

variable "os_disk_size_gb" {
  description = "OS disk size in GB"
  type        = number
}

variable "private_subnet_id" {
  description = "Private subnet ID for AKS nodes"
  type        = string
}

variable "service_cidr" {
  description = "Kubernetes service CIDR"
  type        = string
}

variable "dns_service_ip" {
  description = "Kubernetes DNS service IP"
  type        = string
}

variable "pod_cidr" {
  description = "Kubernetes pod CIDR"
  type        = string
}

variable "kubernetes_version" {
  description = "Kubernetes version"
  type        = string
  default     = "1.33.0"
}

variable "default_node_pool_count" {
  description = "Default node pool initial count"
  type        = number
  default     = 1
}

variable "default_node_pool_min_count" {
  description = "Default node pool minimum count"
  type        = number
  default     = 1
}

variable "default_node_pool_max_count" {
  description = "Default node pool maximum count"
  type        = number
  default     = 3
}

variable "user_node_pool_count" {
  description = "User node pool count"
  type        = number
  default     = 1
}

variable "acr_id" {
  description = "Azure Container Registry ID"
  type        = string
}

variable "tags" {
  description = "Resource tags"
  type        = map(string)
  default     = {}
}
