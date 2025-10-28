# ---------- S3 ----------
resource "aws_s3_bucket" "videos" {
  bucket        = "a2-group31-videos"
  force_destroy = true

  tags = {
    qut-username = "n1234567@qut.edu.au"
    purpose      = "assignment2"
  }
}

# ---------- DynamoDB ----------
resource "aws_dynamodb_table" "uploads" {
  name         = "a2-31-uploads"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "itemId"

  attribute {
    name = "itemId"
    type = "S"
  }

  tags = {
    qut-username = "n1234567@qut.edu.au"
    purpose      = "assignment2"
  }
}

# ---------- ElastiCache Memcached ----------
resource "aws_elasticache_cluster" "cache" {
  cluster_id           = "a2-31-cache"
  engine               = "memcached"
  node_type            = "cache.t2.micro"
  num_cache_nodes      = 1
  parameter_group_name = "default.memcached1.6"
  port                 = 11211

  tags = {
    qut-username = "n1234567@qut.edu.au"
    purpose      = "assignment2"
  }
}

# ---------- Cognito ----------
resource "aws_cognito_user_pool" "users" {
  name = "a2-31-user-pool"

  tags = {
    qut-username = "n1234567@qut.edu.au"
    purpose      = "assignment2"
  }
}

resource "aws_cognito_user_pool_client" "users_client" {
  name         = "a2-31-user-client"
  user_pool_id = aws_cognito_user_pool.users.id
}
