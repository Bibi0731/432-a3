# Terraform setup#
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  required_version = ">= 1.5.0"
}

provider "aws" {
  region = "ap-southeast-2"
}


# SQS Queue (Load Distribution)#
resource "aws_sqs_queue" "transcode_queue" {
  name                      = "a3-transcode-queue"
  visibility_timeout_seconds = 300
  message_retention_seconds  = 86400
}

resource "aws_sqs_queue" "transcode_dlq" {
  name = "a3-transcode-dlq"
}

resource "aws_sqs_queue_redrive_allow_policy" "dlq_policy" {
  queue_url = aws_sqs_queue.transcode_dlq.id

  redrive_allow_policy = jsonencode({
    redrivePermission = "byQueue",
    sourceQueueArns   = [aws_sqs_queue.transcode_queue.arn]
  })
}


# ECS Cluster (Core Microservices)#
resource "aws_ecs_cluster" "main" {
  name = "a3-main-cluster"
}


# IAM Role for ECS Tasks#
resource "aws_iam_role" "ecs_task_role" {
  name = "a3-ecs-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Action = "sts:AssumeRole",
      Effect = "Allow",
      Principal = {
        Service = "ecs-tasks.amazonaws.com"
      }
    }]
  })
}

# ALB (Load Balancer for API)#
resource "aws_lb" "api_lb" {
  name               = "a3-api-lb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = []
  subnets            = ["subnet-xxxxxx", "subnet-yyyyyy"] # 换成你的
}

resource "aws_lb_target_group" "api_tg" {
  name     = "a3-api-tg"
  port     = 80
  protocol = "HTTP"
  vpc_id   = "vpc-xxxxxx" # 换成你的
}

resource "aws_lb_listener" "api_listener" {
  load_balancer_arn = aws_lb.api_lb.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api_tg.arn
  }
}


# ECS Service (API + Transcode)#
resource "aws_ecs_task_definition" "api_task" {
  family                   = "a3-api-service"
  network_mode              = "awsvpc"
  requires_compatibilities  = ["FARGATE"]
  cpu                       = "256"
  memory                    = "512"
  execution_role_arn        = aws_iam_role.ecs_task_role.arn
  container_definitions = jsonencode([
    {
      name      = "api"
      image     = "901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/api-service:latest"
      essential = true
      portMappings = [{
        containerPort = 80
        hostPort      = 80
      }]
    }
  ])
}

resource "aws_ecs_task_definition" "transcode_task" {
  family                   = "a3-transcode-service"
  network_mode              = "awsvpc"
  requires_compatibilities  = ["FARGATE"]
  cpu                       = "512"
  memory                    = "1024"
  execution_role_arn        = aws_iam_role.ecs_task_role.arn
  container_definitions = jsonencode([
    {
      name      = "transcode"
      image     = "901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/transcode-service:latest"
      essential = true
    }
  ])
}

resource "aws_ecs_service" "api_service" {
  name            = "a3-api-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api_task.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = ["subnet-xxxxxx"]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api_tg.arn
    container_name   = "api"
    container_port   = 80
  }
}

resource "aws_ecs_service" "transcode_service" {
  name            = "a3-transcode-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.transcode_task.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = ["subnet-yyyyyy"]
    assign_public_ip = true
  }
}


# Auto Scaling for Transcode service#
resource "aws_appautoscaling_target" "transcode_scaling" {
  max_capacity       = 3
  min_capacity       = 1
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.transcode_service.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "cpu_policy" {
  name               = "a3-transcode-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.transcode_scaling.resource_id
  scalable_dimension = aws_appautoscaling_target.transcode_scaling.scalable_dimension
  service_namespace  = aws_appautoscaling_target.transcode_scaling.service_namespace

  target_tracking_scaling_policy_configuration {
    target_value       = 70
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    scale_in_cooldown  = 60
    scale_out_cooldown = 60
  }
}
