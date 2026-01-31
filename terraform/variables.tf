variable "environment" {
  type = string
  default = "dev"
}

variable "projectname" {
  type = string
  default = "ginraidee"
}

variable "subscription_id" {
  type        = string
  description = "Azure Subscription ID."
}

variable "location" {
  type        = string
  description = "Location of the resource group."
  default     = "southeastasia"
}

variable "tenant_id" {
  type        = string
  description = "Azure tenant ID."
}

variable "location-abbreviation" {
  type        = string
  description = "Abbreviation of Location of the resource group."
  default     = "sea"
}

variable "vnet_address_space" {
  type        = list(string)
  description = "VNet Address Space."
  default     = ["111.0.0.0/16"]
}

variable "subnet_details" {
  type = map(list(string))
  description = "Subnets."
  default = {
    public      = ["111.0.0.0/24"]
    enterprise  = ["111.0.1.0/24"]
    private     = ["111.0.2.0/24"]
    app_gateway = ["111.0.3.0/24"]
    postgresql  = ["111.0.4.0/24"]
  }
}

#variables for AKS cluster
variable "vm_size" {
  description = "Size of vm of AKS cluster"
  type        = string
}
variable "os_disk_size_gb" {
  description = "Size of vm of AKS cluster"
  type        = string
}

variable "service_cidr" {
  description = "The CIDR range for Kubernetes services."
  type        = string
}

variable "dns_service_ip" {
  description = "The IP address within the `service_cidr` range for DNS."
  type        = string
}
variable "pod_cidr" {
  description = "The CIDR range for pods."
  type        = string
}

#variables for postgresql
variable "postgresql_admin_username" {
  description = "The administrator username for the PostgreSQL server."
  type        = string
}
variable "postgresql_admin_password" {
  description = "The administrator password for the PostgreSQL server."
  type        = string
}
variable "postgresql_size" {
  description = "The size of the PostgreSQL server."
  type        = string
}

#variables for openai
variable "openai_location" {
  description = "The region for OpenAI."
  type        = string
}
variable "openai_location_abbreviation" {
  description = "The abbreviation for the region for OpenAI."
  type        = string
  default = "East US 2"
}

#variables for VM
variable "runner_vm_size" {
  description = "Size of vm of AKS cluster"
  type        = string
  default = "Standard_D2s_v3"
}