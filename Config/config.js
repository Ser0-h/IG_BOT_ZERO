{
  "bot": {
    "name": "ICA",
    "author": "Idle×Saow",
    "version": "1.0.0",
    "language": "en",
    "timezone": "Asia/Dhaka",
    "autoMarkRead": true,
    "typing": true,
    "autoReact": false,
    "selfListen": false
  },

  "prefix": {
    "global": "!",
    "chat": "!",
    "noPrefix": false
  },

  "admin": {
    "botAdmins": [],
    "boxAdmins": [],
    "ownerIDs": []
  },

  "command": {
    "directory": "./commands",
    "cooldown": 3,
    "allowAliases": true,
    "caseInsensitive": true
  },

  "event": {
    "directory": "./events",
    "enabled": true
  },

  "database": {
    "enabled": true,

    "primary": "mongodb",

    "fallback": "sqlite",

    "mongodb": {
      "enabled": true,
      "uriEnv": "MONGODB_URI",
      "databaseName": "ica"
    },

    "sqlite": {
      "enabled": true,
      "file": "./data/ica.sqlite"
    },

    "collections": {
      "users": "users",
      "threads": "threads",
      "settings": "settings",
      "system": "system",
      "logs": "logs"
    }
  },

  "api": {
    "timeout": 15000,
    "retries": 2
  },

  "security": {
    "whitelist": [],
    "blacklist": [],
    "maintenance": false
  },

  "system": {
    "debug": false,
    "logLevel": "info",
    "environment": "production"
  }
}