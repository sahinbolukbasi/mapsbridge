# GitHub Actions OIDC — deploy role used by CI/CD pipeline
# Role ARN stored as GitHub secret AWS_DEPLOY_ROLE_ARN

data "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"
}

resource "aws_iam_role" "github_deploy" {
  name = "${local.name}-github-deploy"
  tags = local.tags

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = data.aws_iam_openid_connect_provider.github.arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringLike = {
          "token.actions.githubusercontent.com:sub" = "repo:sahinbolukbasi/mapsbridge:ref:refs/heads/main"
        }
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
        }
      }
    }]
  })
}

resource "aws_iam_role_policy" "github_deploy" {
  name = "deploy"
  role = aws_iam_role.github_deploy.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "S3Deploy"
        Effect   = "Allow"
        Action   = ["s3:PutObject", "s3:GetObject", "s3:DeleteObject", "s3:ListBucket", "s3:PutObjectAcl", "s3:CreateBucket", "s3:PutBucketVersioning", "s3:PutBucketPolicy", "s3:DeleteBucket", "s3:PutEncryptionConfiguration", "s3:PutLifecycleConfiguration", "s3:PutBucketNotification"]
        Resource = ["arn:aws:s3:::${local.name}-*", "arn:aws:s3:::${local.name}-*/*"]
      },
      {
        Sid      = "CloudFrontInvalidate"
        Effect   = "Allow"
        Action   = ["cloudfront:CreateInvalidation", "cloudfront:GetDistribution"]
        Resource = [aws_cloudfront_distribution.web.arn]
      },
      {
        Sid    = "LambdaFullManage"
        Effect = "Allow"
        Action = [
          "lambda:*",
        ]
        Resource = "*"
      },
      {
        Sid      = "SSMRead"
        Effect   = "Allow"
        Action   = ["ssm:GetParameter", "ssm:GetParameters", "ssm:GetParametersByPath", "ssm:DescribeParameters", "ssm:PutParameter", "ssm:DeleteParameter"]
        Resource = "arn:aws:ssm:${var.aws_region}:*:parameter/mapsbridge/*"
      },
      {
        Sid      = "EC2Read"
        Effect   = "Allow"
        Action   = ["ec2:*"]
        Resource = "*"
      },
      {
        Sid    = "TerraformStateFullAccess"
        Effect = "Allow"
        Action = [
          "s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:ListBucket",
          "s3:GetBucketVersioning", "s3:GetEncryptionConfiguration", "s3:GetBucketPolicy",
          "s3:GetBucketAcl", "s3:GetBucketCORS", "s3:GetBucketWebsite",
          "s3:GetBucketTagging", "s3:PutBucketTagging", "s3:GetLifecycleConfiguration",
          "s3:GetBucketLogging", "s3:GetBucketRequestPayment", "s3:GetBucketObjectLockConfiguration",
          "s3:GetReplicationConfiguration", "s3:GetAccelerateConfiguration",
          "s3:GetBucketPublicAccessBlock", "s3:PutBucketPublicAccessBlock",
          "s3:GetBucketOwnershipControls", "s3:PutBucketOwnershipControls",
        ]
        Resource = [
          "arn:aws:s3:::mapsbridge-*",
          "arn:aws:s3:::mapsbridge-*/*",
          "arn:aws:s3:::${local.name}-terraform-state",
          "arn:aws:s3:::${local.name}-terraform-state/*",
        ]
      },
      {
        Sid    = "TerraformFullManage"
        Effect = "Allow"
        Action = [
          "cloudfront:*",
          "wafv2:*",
          "ce:*",
          "budgets:*",
          "elasticache:*",
          "rds:*",
          "kms:Describe*", "kms:Get*", "kms:List*", "kms:CreateKey", "kms:CreateAlias",
          "kms:EnableKeyRotation", "kms:ScheduleKeyDeletion", "kms:TagResource",
          "iam:GetRole", "iam:GetRolePolicy", "iam:PutRolePolicy", "iam:CreateRole",
          "iam:DeleteRole", "iam:UpdateRole", "iam:UpdateAssumeRolePolicy",
          "iam:AttachRolePolicy", "iam:DetachRolePolicy", "iam:DeleteRolePolicy",
          "iam:PassRole", "iam:TagRole", "iam:UntagRole", "iam:ListRolePolicies",
          "iam:ListAttachedRolePolicies", "iam:ListInstanceProfilesForRole",
          "iam:GetOpenIDConnectProvider", "iam:ListOpenIDConnectProviders",
          "iam:CreateOpenIDConnectProvider", "iam:AddClientIDToOpenIDConnectProvider",
          "bedrock:*",
          "s3vectors:*",
          "cloudtrail:*",
          "aoss:*",
          "resource-groups:*",
          "logs:*",
          "cognito-idp:*",
          "dynamodb:*",
          "firehose:*",
          "glue:*",
          "athena:*",
          "sqs:*",
          "sns:*",
          "apigateway:*",
          "execute-api:*",
          "scheduler:*",
          "acm:*",
          "tag:*",
        ]
        Resource = "*"
      }
    ]
  })
}

output "github_deploy_role_arn" {
  description = "Set as GitHub secret AWS_DEPLOY_ROLE_ARN"
  value       = aws_iam_role.github_deploy.arn
}
