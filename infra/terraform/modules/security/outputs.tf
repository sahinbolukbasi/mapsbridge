output "waf_acl_arn" {
  value       = var.enable_waf ? aws_wafv2_web_acl.api[0].arn : null
  description = "ARN of the WAF WebACL"
}

output "waf_acl_id" {
  value       = var.enable_waf ? aws_wafv2_web_acl.api[0].id : null
  description = "ID of the WAF WebACL"
}
