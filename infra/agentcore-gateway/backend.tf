terraform {
  backend "s3" {
    bucket         = "mapsbridge-terraform-state-865369794421"
    key            = "prod/agentcore-gateway.tfstate"
    region         = "eu-central-1"
    dynamodb_table = "mapsbridge-terraform-locks"
    encrypt        = true
  }
}
