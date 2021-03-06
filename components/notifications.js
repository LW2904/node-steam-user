var SteamUser = require('../index.js');
var SteamID = require('steamid');

SteamUser.prototype._requestNotifications = function() {
	this._send(SteamUser.EMsg.ClientRequestItemAnnouncements, {});
	this._send(SteamUser.EMsg.ClientRequestCommentNotifications, {});
	this._send(SteamUser.EMsg.ClientFSRequestOfflineMessageCount, {});
};

// Handlers

SteamUser.prototype._handlers[SteamUser.EMsg.ClientItemAnnouncements] = function(body) {
	this.emit('newItems', body.count_new_items);
};

SteamUser.prototype._handlers[SteamUser.EMsg.ClientCommentNotifications] = function(body) {
	this.emit('newComments', body.count_new_comments, body.count_new_comments_owner, body.count_new_comments_subscriptions);
};

SteamUser.prototype._handlers[SteamUser.EMsg.ClientUserNotifications] = function(body) {
	// Steam apparently sends a count of 0 as a lack of any notifications at all
	if (body.notifications && body.notifications.length == 0) {
		body.notifications.push({"user_notification_type": 1, "count": 0});
	}

	(body.notifications || []).forEach((notification) => {
		if (notification.user_notification_type == 1) {
			if (this._lastTradeOfferCount !== notification.count) {
				this.emit('tradeOffers', notification.count);
				this._lastTradeOfferCount = notification.count;
			}
		} else {
			this.emit('debug', 'Unknown notification type ' + notification.user_notification_type + ': ' + notification.count + '!');
		}
	});
};

SteamUser.prototype._handlers[SteamUser.EMsg.ClientFSOfflineMessageNotification] = function(body) {
	var self = this;
	this.emit('offlineMessages', body.offline_messages, (body.friends_with_offline_messages || []).map(function(accountid) {
		var sid = new SteamID();
		sid.universe = self.steamID.universe;
		sid.type = SteamID.Type.INDIVIDUAL;
		sid.instance = SteamID.Instance.DESKTOP;
		sid.accountid = accountid;
		return sid.toString();
	}));
};

SteamUser.prototype._handlers[SteamUser.EMsg.ClientMarketingMessageUpdate2] = function(body) {
	var time = body.readUint32();
	var count = body.readUint32();

	var messages = [];

	for (var i = 0; i < count; i++) {
		body.readUint32(); // Length of this submessage

		messages.push({
			"id": body.readUint64().toString(),
			"url": body.readCString(),
			"flags": body.readUint32()
		});
	}

	this.emit('marketingMessages', new Date(time * 1000), messages);
};
