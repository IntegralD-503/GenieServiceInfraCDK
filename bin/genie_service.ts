#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { GenieServiceStack } from '../lib/genie_service-stack';
import { PipelineStack } from '../pipeline/pipeline-stack';

const app = new cdk.App();
const pipeline = new PipelineStack(app, "GenieServicePipelineStack")
const genieService = new GenieServiceStack(app, 'GenieServiceStack', {});

pipeline.addGenieServiceStage(genieService, "Beta")

