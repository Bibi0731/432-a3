require("dotenv").config();
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
    DynamoDBDocumentClient,
    PutCommand,
    GetCommand,
    QueryCommand,
    UpdateCommand,
    DeleteCommand
} = require("@aws-sdk/lib-dynamodb");
const { fromIni } = require("@aws-sdk/credential-providers");
const { v4: uuidv4 } = require("uuid");

const client = new DynamoDBClient({
    region: process.env.AWS_REGION,
    credentials: fromIni({ profile: process.env.AWS_PROFILE || "default" })
});
const ddb = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "a2-31-outputs";

module.exports = {
    async create(record) {
        const id = uuidv4();
        const item = {
            "qut-username": process.env.QUT_USERNAME,
            itemId: id,
            ...record,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        await ddb.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
        return { id, ...item };
    },

    async getById(id) {
        const res = await ddb.send(new GetCommand({
            TableName: TABLE_NAME,
            Key: { "qut-username": process.env.QUT_USERNAME, itemId: id }
        }));
        if (!res.Item) return null;
        return { id: res.Item.itemId, ...res.Item };
    },

    async getByOwner(ownerId) {
        const res = await ddb.send(new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: "#pk = :username",
            ExpressionAttributeNames: { "#pk": "qut-username" },
            ExpressionAttributeValues: { ":username": process.env.QUT_USERNAME },
            FilterExpression: "ownerId = :ownerId",
            ExpressionAttributeValues: {
                ":username": process.env.QUT_USERNAME,
                ":ownerId": ownerId
            }
        }));
        return (res.Items || []).map(x => ({ id: x.itemId, ...x }));
    },

    async getAll() {
        const res = await ddb.send(new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: "#pk = :username",
            ExpressionAttributeNames: { "#pk": "qut-username" },
            ExpressionAttributeValues: { ":username": process.env.QUT_USERNAME }
        }));
        return (res.Items || []).map(x => ({ id: x.itemId, ...x }));
    },

    async update(id, ownerId, patch) {
        if (!patch || Object.keys(patch).length === 0) {
            throw new Error("No fields to update");
        }
        const updates = Object.keys(patch).map(k => `${k} = :${k}`).join(", ");
        const values = {};
        Object.keys(patch).forEach(k => { values[`:${k}`] = patch[k]; });

        const res = await ddb.send(new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { "qut-username": process.env.QUT_USERNAME, itemId: id },
            UpdateExpression: `SET ${updates}, updatedAt = :u`,
            ExpressionAttributeValues: {
                ...values,
                ":u": new Date().toISOString(),
                ":ownerId": ownerId
            },
            ConditionExpression: "ownerId = :ownerId",
            ReturnValues: "ALL_NEW"
        }));
        return { id, ...res.Attributes };
    },

    async remove(id, ownerId) {
        await ddb.send(new DeleteCommand({
            TableName: TABLE_NAME,
            Key: { "qut-username": process.env.QUT_USERNAME, itemId: id },
            ConditionExpression: "ownerId = :ownerId",
            ExpressionAttributeValues: { ":ownerId": ownerId }
        }));
        return true;
    },

    async removeAdmin(id) {
        await ddb.send(new DeleteCommand({
            TableName: TABLE_NAME,
            Key: { "qut-username": process.env.QUT_USERNAME, itemId: id }
        }));
        return true;
    }
};
