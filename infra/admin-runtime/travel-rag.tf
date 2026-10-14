# Set only after the independently managed infra/travel-rag stack is ready.
variable "travel_knowledge_base_id" {
  type    = string
  default = ""
  validation {
    condition     = var.travel_knowledge_base_id == "" || can(regex("^[A-Za-z0-9]{10}$", var.travel_knowledge_base_id))
    error_message = "Expected a Bedrock knowledge base ID."
  }
}
resource "aws_iam_role_policy" "travel_retrieval" {
  count = var.travel_knowledge_base_id == "" ? 0 : 1
  name  = "travel-knowledge-retrieve"
  role  = aws_iam_role.domain["ai"].id
  policy = jsonencode({ Version = "2012-10-17", Statement = [{
    Effect   = "Allow", Action = ["bedrock:Retrieve"],
    Resource = "arn:aws:bedrock:${var.region}:${var.account_id}:knowledge-base/${var.travel_knowledge_base_id}"
  }] })
}

resource "aws_iam_role_policy" "place_research" {
  name = "travel-place-research"
  role = aws_iam_role.domain["ai"].id
  policy = jsonencode({ Version = "2012-10-17", Statement = [{
    Effect   = "Allow", Action = ["geo-places:Geocode", "geo-places:SearchText"],
    Resource = "arn:aws:geo-places:${var.region}::provider/default"
  }] })
}
