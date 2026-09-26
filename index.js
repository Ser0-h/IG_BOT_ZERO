"use strict";

/**
 * index.js — main application bootstrap/orchestrator.
 *
 * IMPORTANT — READ THIS FIRST:
 * This repo's `auth.js`, `config.json` shape, and the actual Instagram
 * API/client module could not be directly inspected when this file was
 * written (GitHub fetch access was unavailable in that session). Every
 * spot marked "ADAPT:" below makes a *defensive* attempt — it probes a
 * few common shapes/paths instead of assuming one fixed (possibly wrong)
 * API — but you should confirm each ADAPT block against your real files
 * and trim the ones that don't apply.
 *
 * Confirmed against files already inspected directly:
 *  - src/commandLoader.js exports { createRegistry, loadAll }. loadAll()
 *    clears the registry and loads BOTH commands/ and events/ in one call,
 *    so it's called once here and is safe to call again for a live reload.
 *  - src/logger.js is the existing logger (commandLoader.js already calls
 *    log.error / log.warn / log.success on it) — reused as-is, no new
 *    logging framework introduced.
 *  - Commands (e.g. commands/pair.js) expect
 *    onStart({ message, event, api, usersData }) and validate() requires
 *    config.name + config.category + (onStart or onEvent).
 */

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const log = require("./src/logger");
const { createRegistry, loadAll } = require("./src/commandLoader");

/* =====================================================
 SMALL HELPER: require the first module that exists, from a candidate
 list of relative paths. Used only where the real module name/location
 wasn't confirmed — keeps the bootstrap from hard-failing on a guessed
 path while never silently inventing behavior (if none exist, it says so).
===================================================== */

function resolveFirstExisting(candidates) {
	for (const rel of candidates) {
		const full = path.join(ROOT, rel);
		if (fs.existsSync(full) || fs.existsSync(full + ".js")) {
			return { rel, mod: require(full) };
		}
	}
	return null;
}

/* =====================================================
 STEP 1: ENVIRONMENT
===================================================== */

function loadEnvironment() {
	try {
		require("dotenv").config();
	} catch (_) {
		// dotenv not installed — fine, env vars can be set by the host directly.
	}
}

/* =====================================================
 STEP 2: CONFIG
===================================================== */

function loadConfig() {
	const configPath = path.join(ROOT, "config.json");
	let config = {};

	if (fs.existsSync(configPath)) {
		try {
			config = JSON.parse(fs.readFileSync(configPath, "utf8"));
		} catch (e) {
			log.error("CONFIG", `config.json is invalid JSON: ${e.message}`);
			process.exit(1);
		}
	} else {
		log.warn("CONFIG", "config.json not found — continuing with defaults + env only");
	}

	// Environment variables override file config where both are set.
	if (process.env.PORT) config.port = Number(process.env.PORT);
	if (process.env.NODE_ENV) config.env = process.env.NODE_ENV;
	if (process.env.MONGODB_URI) config.mongodbUrl = process.env.MONGODB_URI;

	config.prefix = config.prefix || "!";

	// mongodbUrl is expected directly in config.json, e.g.:
	//   { "mongodbUrl": "mongodb+srv://user:pass@cluster.mongodb.net/instabot" }
	// MONGODB_URI env var, if set, takes priority over this value (see above).
	if (!config.mongodbUrl) {
		log.warn("CONFIG", 'No "mongodbUrl" in config.json (and no MONGODB_URI env var) — commands will run without usersData.');
	}

	return config;
}

/* =====================================================
 STEP 3: AUTHENTICATION
 ADAPT: auth.js's real export shape wasn't available to confirm. This
 tries the shapes most repos of this kind use, in order, and fails
 clearly (naming the file) if none match — update this block to call
 auth.js exactly the way it's actually exported.
===================================================== */

async function initializeAuth(config) {
	let auth;
	try {
		auth = require("./auth");
	} catch (e) {
		log.error("AUTH", `Could not load auth.js: ${e.message}`);
		throw e;
	}

	const accountPath = path.join(ROOT, "account.txt");
	const ctx = {
		config,
		accountPath: fs.existsSync(accountPath) ? accountPath : null,
		cookies: process.env.IG_COOKIES || null
	};

	try {
		if (typeof auth === "function") return await auth(ctx);
		if (auth && typeof auth.login === "function") return await auth.login(ctx);
		if (auth && typeof auth.init === "function") return await auth.init(ctx);
		if (auth && typeof auth.getSession === "function") return await auth.getSession(ctx);

		throw new Error(
			'auth.js exports none of: a function, ".login()", ".init()", ".getSession()". ' +
			"Update initializeAuth() in index.js to match its real export."
		);
	} catch (e) {
		log.error("AUTH", `Authentication failed: ${e.message}`);
		if (!ctx.accountPath && !ctx.cookies) {
			log.error("AUTH", "No account.txt found and no IG_COOKIES env var set — nothing to authenticate with.");
		}
		throw e;
	}
}

/* =====================================================
 STEP 4: API / CLIENT
 ADAPT: the module that actually talks to Instagram (getUserInfo,
 getThreadInfo, message.reply, etc. used by commands/pair.js) wasn't
 confirmed. This looks in the most likely locations for this repo layout
 and requires whichever one exists — check the log line it prints on
 startup and adjust the candidate list if it's somewhere else.
===================================================== */

async function initializeAPI(session, config) {
	const found = resolveFirstExisting([
		"src/bot",
		"src/client",
		"src/api",
		"src/instagram",
		"bot"
	]);

	if (!found) {
		throw new Error(
			"Could not find the API/client module (checked src/bot.js, src/client.js, " +
			"src/api.js, src/instagram.js, bot.js). Update the candidate list in " +
			"initializeAPI() in index.js to point at the real file."
		);
	}

	log.success("API", `Using client module: ${found.rel}.js`);
	const mod = found.mod;

	let api;
	if (typeof mod === "function") {
		api = await mod(session, config);
	} else if (mod && typeof mod.connect === "function") {
		api = await mod.connect(session, config);
	} else if (mod && typeof mod.createClient === "function") {
		api = await mod.createClient(session, config);
	} else {
		// Already an initialized client instance/object.
		api = mod;
	}

	if (!api) throw new Error(`${found.rel}.js did not return a usable API/client.`);
	return api;
}

/* =====================================================
 STEP 5: DATABASE / USER DATA (MongoDB)
 Connects with a MongoDB connection string (MONGODB_URI env var, or
 config.mongodbUrl as a fallback) and exposes a `usersData` object shaped
 the way commands already expect (pair.js calls usersData.get(userId)):
   usersData.get(userId)         -> stored user doc, or null
   usersData.set(userId, patch)  -> upsert-merges patch into the doc
   usersData.collection          -> raw MongoDB collection, for anything
                                     a command needs beyond get/set
 Requires the "mongodb" package: npm install mongodb
===================================================== */

async function initializeDatabase(config) {
	const uri = config.mongodbUrl;

	if (!uri) {
		log.warn("DATA", "No MongoDB URL configured — commands will run without usersData.");
		return { client: null, usersData: undefined };
	}

	let MongoClient;
	try {
		({ MongoClient } = require("mongodb"));
	} catch (e) {
		log.error("DATA", 'MongoDB URL configured but the "mongodb" package is not installed. Run: npm install mongodb');
		throw e;
	}

	const client = new MongoClient(uri);

	try {
		await client.connect();
	} catch (e) {
		log.error("DATA", `Could not connect to MongoDB: ${e.message}`);
		throw e;
	}

	// Database name comes from the URI path if it has one, else "instabot".
	const dbNameFromUri = (() => {
		try {
			const afterSlash = uri.split("/").pop();
			const name = afterSlash.split("?")[0];
			return name || "instabot";
		} catch (_) {
			return "instabot";
		}
	})();

	const db = client.db(config.mongodbDbName || dbNameFromUri);
	const collection = db.collection("users");
	await collection.createIndex({ userId: 1 }, { unique: true }).catch(() => {});

	const usersData = {
		collection,

		async get(userId) {
			const doc = await collection.findOne({ userId: String(userId) });
			return doc || null;
		},

		async set(userId, patch) {
			await collection.updateOne(
				{ userId: String(userId) },
				{ $set: { ...patch, userId: String(userId) } },
				{ upsert: true }
			);
			return this.get(userId);
		}
	};

	log.success("DATA", `MongoDB connected (db: ${db.databaseName})`);
	return { client, usersData };
}

/* =====================================================
 STEP 6: COMMAND + EVENT LOADING
===================================================== */

function loadCommandsAndEvents() {
	const registry = createRegistry();
	const { commandCount, eventCount } = loadAll(registry);

	const aliasCount = registry.aliases.size - registry.commands.size;
	return { registry, commandCount, eventCount, aliasCount };
}

/* =====================================================
 STEP 7: DISPATCHER
 ADAPT: the exact event name the API/client emits for an incoming
 message wasn't confirmed. Listens on the common candidates below —
 harmless no-ops for any name the client doesn't actually use.
===================================================== */

function startDispatcher(api, registry, config, usersData) {
	if (!api || typeof api.on !== "function") {
		log.warn("DISPATCH", "API/client has no .on() — cannot attach a message listener. Check initializeAPI().");
		return;
	}

	const candidateEvents = ["message", "event", "thread_update", "realtime_message"];
	const prefix = config.prefix || "!";

	const handleIncoming = async (event) => {
		try {
			for (const script of registry.events) {
				if (typeof script.onEvent === "function") {
					Promise.resolve(script.onEvent({ event, api, usersData, config })).catch((e) =>
						log.error("EVENT", `${script.config.name} failed: ${e.message}`)
					);
				}
			}

			const text = event && (event.body || event.text || event.message);
			if (typeof text !== "string" || !text.startsWith(prefix)) return;

			const args = text.slice(prefix.length).trim().split(/\s+/);
			const commandName = args.shift().toLowerCase();
			const command = registry.resolve(commandName);
			if (!command) return;

			const message = event.message || event; // ADAPT: confirm which field carries .reply()
			await command.onStart({ message, event, api, usersData, args, config });
		} catch (e) {
			log.error("DISPATCH", `Unhandled error processing event: ${e.message}`);
		}
	};

	for (const name of candidateEvents) {
		api.on(name, handleIncoming);
	}

	log.success("DISPATCH", "Message dispatcher attached");
}

/* =====================================================
 STEP 8: OPTIONAL SERVER (only if one already exists in the repo)
===================================================== */

function startServerIfPresent(config) {
	const found = resolveFirstExisting(["src/server", "server"]);
	if (!found) return null;

	const mod = found.mod;
	const port = config.port || process.env.PORT || 3000;

	let serverHandle = null;
	if (typeof mod === "function") serverHandle = mod(port, config);
	else if (mod && typeof mod.start === "function") serverHandle = mod.start(port, config);
	else if (mod && typeof mod.listen === "function") serverHandle = mod.listen(port);

	log.success("SERVER", `${found.rel}.js started on port ${port}`);
	return serverHandle;
}

/* =====================================================
 PROCESS-LEVEL ERROR HANDLING
===================================================== */

function installGlobalErrorHandlers(shutdown) {
	process.on("uncaughtException", (err) => {
		log.error("FATAL", `Uncaught exception: ${err.message}`);
		console.error(err);
	});

	process.on("unhandledRejection", (reason) => {
		const message = reason instanceof Error ? reason.message : String(reason);
		log.error("FATAL", `Unhandled rejection: ${message}`);
	});

	process.on("SIGINT", () => shutdown("SIGINT"));
	process.on("SIGTERM", () => shutdown("SIGTERM"));
}

/* =====================================================
 BOOTSTRAP
===================================================== */

async function main() {
	console.log("\n╭──────────────────────────────╮");
	console.log("│        ICA • STARTUP         │");
	console.log("╰──────────────────────────────╯\n");

	let api = null;
	let serverHandle = null;
	let dbClient = null;

	const shutdown = async (signal) => {
		log.warn("SHUTDOWN", `Received ${signal}, shutting down...`);
		try {
			if (api && typeof api.disconnect === "function") await api.disconnect();
			else if (api && typeof api.close === "function") await api.close();
		} catch (e) {
			log.error("SHUTDOWN", `Error closing API/client: ${e.message}`);
		}
		try {
			if (dbClient) await dbClient.close();
		} catch (e) {
			log.error("SHUTDOWN", `Error closing MongoDB connection: ${e.message}`);
		}
		try {
			if (serverHandle && typeof serverHandle.close === "function") serverHandle.close();
		} catch (e) {
			log.error("SHUTDOWN", `Error closing server: ${e.message}`);
		}
		process.exit(0);
	};

	installGlobalErrorHandlers(shutdown);

	loadEnvironment();
	const config = loadConfig();
	log.success("STARTUP", "Configuration loaded");

	let session;
	try {
		session = await initializeAuth(config);
		log.success("STARTUP", "Authentication initialized");
	} catch (e) {
		log.error("STARTUP", "Authentication is a critical dependency — cannot continue.");
		process.exit(1);
		return;
	}

	try {
		api = await initializeAPI(session, config);
		log.success("STARTUP", "API connected");
	} catch (e) {
		log.error("STARTUP", `API/client is a critical dependency: ${e.message}`);
		process.exit(1);
		return;
	}

	let usersData;
	try {
		const dbResult = await initializeDatabase(config);
		dbClient = dbResult.client;
		usersData = dbResult.usersData;
		log.success("STARTUP", "Database initialized");
	} catch (e) {
		log.error("STARTUP", `Database is a critical dependency: ${e.message}`);
		process.exit(1);
		return;
	}

	const { registry, commandCount, eventCount, aliasCount } = loadCommandsAndEvents();
	log.success("STARTUP", `Commands loaded (${commandCount} commands, ${aliasCount} aliases)`);
	log.success("STARTUP", `Events loaded (${eventCount})`);

	startDispatcher(api, registry, config, usersData);
	serverHandle = startServerIfPresent(config);

	log.success("STARTUP", "Bot is ready");
}

main().catch((e) => {
	log.error("FATAL", `Startup failed: ${e.message}`);
	process.exit(1);
});
