terraform {
  backend "s3" {
    bucket         = "mapsbridge-terraform-state-865369794421"
    key            = "prod/ai-memory.tfstate"
    region         = "eu-central-1"
    dynamodb_table = "mapsbridge-terraform-locks"
    encrypt        = true
  }
}
