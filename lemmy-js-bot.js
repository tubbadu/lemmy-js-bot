import { LemmyHttp } from 'lemmy-js-client';
import Db from "./db.js"

function db_init(){
	Db.init("./data.db");
	
	Db.createTable("subscribed_communities", {
		community_id: "int"
	}, "community_id");
	Db.createTable("processedComments", {
		id: "int"
	}, "id");
	Db.createTable("processedPosts", {
		id: "int"
	}, "id");
	Db.createTable("processedMentions", {
		id: "int"
	}, "id");
	Db.createTable("processedPrivateMessages", {
		id: "int"
	}, "id");
	Db.createTable("reminders", {
		request_comment_id: "int",
		time: "char(26)"
	}, "request_comment_id");
}

export class LemmyJSBot{
	constructor(p){
		this.dbfile = p.dbfile ?? "./data.db";
		this.loginForm = p.loginForm;
		this.instance = p.instance;
		
		this.refreshInterval = this.refreshInterval ?? 5000;
		
		this.onNewComment = p.onNewComment ?? function(){};
		this.onNewPost = p.onNewPost ?? function(){};
		this.onNewMention = p.onNewMention ?? function(){};
		this.onNewCommentKeywordMention = p.onNewCommentKeywordMention ?? function(){};
		this.onNewPostKeywordMention = p.onNewPostKeywordMention ?? function(){};
		this.keywordsMention = p.keywordsMention ?? [];
		this.keywordCaseSensitive = p.keywordCaseSensitive ?? false;
		this.onNewPrivateMessage = p.onNewPrivateMessage ?? function(){};

		const CommentsOptions = p.commentsOptions ?? {};
		this.commentsOptions = {
			sort: CommentsOptions.sort ?? "New",
			listing: CommentsOptions.listing ?? "All",
			communityFilterName: CommentsOptions.communityFilterName,
			communityFilterID: CommentsOptions.communityFilterID,
			savedOnly: CommentsOptions.savedOnly ?? false,
			limit: CommentsOptions.limit,
		};

		const PostsOptions = p.postsOptions ?? {};
		this.postsOptions = {
			sort: PostsOptions.sort ?? "New",
			listing: PostsOptions.listing ?? "All",
			communityFilterName: PostsOptions.communityFilterName,
			communityFilterID: PostsOptions.communityFilterID,
			savedOnly: PostsOptions.savedOnly ?? false,
			limit: PostsOptions.limit,
		};
		
		const MentionsOptions = p.mentionsOptions ?? {};
		this.mentionsOptions = {
			sort: MentionsOptions.sort ?? "New",
			limit: MentionsOptions.limit,
			unread_only: MentionsOptions.unread_only,
		};
		
		const PrivateMessagesOptions = p.privateMessagesOptions ?? {};
		this.privateMessagesOptions = {
			limit: PrivateMessagesOptions.limit,
			unread_only: PrivateMessagesOptions.unread_only,
		};
		this.debug = p.debug ?? false;
		
		this.init();
	}
	
	init(){
		db_init(this.dbfile);
		this.client = new LemmyHttp('https://' + this.instance); // todo perhaps check if instance is defined
		this.tempProcessed = {
			posts: new Set(),
			comments: new Set(),
			private_messages: new Set(),
			mentions: new Set()
		}
		this.newComments = [];
		this.newPosts = [];
		this.newMentions = [];
		this.newKeywordsMention = [];
		this.newPrivateMessage = [];
		this.auth = undefined;
	}
	

	async login(){
		if(this.loginForm){
			let loginResult = await this.client.login(this.loginForm);
			if(loginResult){
				this.auth = loginResult.jwt;
				return true;
			} else {
				return false;
			}
		} else {
			console.warn("No loginForm specified. Proceding in read-only mode.")
			return false;
		}
	}
	
	preventReprocess(x){
		if(x.person_mention){
			Db.insert({
				id: x.person_mention.id,
			}, "processedMentions");
		} else if(x.private_message) {
			Db.insert({
				id: x.private_message.id
			}, "processedPrivateMessages");
		} else if(x.comment){
			Db.insert({
				id: x.comment.id
			}, "processedComments");
		} else if(x.post){
			Db.insert({
				id:  x.post.id
			}, "processedPosts");
		} else {
			// TODO get the type and then add
			console.error("type specified not recognized:", type);
		}
	}
	
	allowReprocess(x){
		// TODO 
	}
	
	start(){
		console.log("Bot started.")
		this.fetchProcess = setInterval(() => this.refresh(), this.refreshInterval);
	}
	
	stop(){
		console.log("Bot stopped.")
		clearInterval(this.fetchProcess);
	}
	
	refreshComments(){
		this.client.getComments({
			auth: this.auth,
			sort: this.commentsOptions.sort,
			type_: this.commentsOptions.listing,
			community_name: this.commentsOptions.communityFilterName,
			community_id: this.commentsOptions.communityFilterID,
			limit: this.commentsOptions.limit,
		}).then(res => {
			res.comments.forEach(comment => {
				if(!this.isSentByMe(comment) && !this.tempProcessed.comments.has(comment.comment.id)){
					let x = Db.check({
						id: comment.comment.id
					}, "processedComments").then(isPresent => {
						if(!isPresent){
							if(!this.checkForCommentKeywordMention(comment)){
								// not already processed
								this.tempProcessed.comments.add(comment.comment.id);
								this.onNewComment(comment)
							}
						}
					}).catch(err => {
						console.log("error:", err)
					});
				}
			});
		});
	}
	
	refreshPosts(){
		this.client.getPosts({
			auth: this.auth,
			sort: this.commentsOptions.sort,
			type_: this.commentsOptions.listing,
			community_name: this.commentsOptions.communityFilterName,
			community_id: this.commentsOptions.communityFilterID,
			limit: this.postsOptions.limit,
		}).then(res => {
			res.posts.forEach(post => {
				if(!this.isSentByMe(post) && !this.tempProcessed.posts.has(post.post.id)){
					Db.check({
						id: post.post.id
					}, "processedPosts").then(isPresent => {
						if(!isPresent){
							if(!!this.checkForPostKeywordMention(post)){
								// not already processed
								this.tempProcessed.posts.add(post.post.id);
								this.onNewPost(post)
							}
						}
					});
				}
			});
		});
	}
	
	refreshMentions(){ // TODO this can be done better
		this.client.getPersonMentions({
			auth: this.auth,
			sort: this.mentionsOptions.sort,
			limit: this.mentionsOptions.limit,
			unread_only: this.mentionsOptions.unread_only,
		}).then(res => {
			res.mentions.forEach(mention => {
				if(!this.isSentByMe(mention) && !this.tempProcessed.mentions.has(mention.person_mention.id)){
					Db.check({
						id: mention.person_mention.id,
					}, "processedMentions").then(isPresent => {
						if(!isPresent){
							// not already processed
							this.tempProcessed.mentions.add(mention.person_mention.id);
							this.onNewMention(mention)
						}
					});
				}
			});
		});
	}
	
	refreshPrivateMessages(){
		this.client.getPrivateMessages({
			auth: this.auth,
			limit: this.privateMessagesOptions.limit,
			unread_only: this.privateMessagesOptions.unread_only,
		}).then(res => {
			res.private_messages.forEach(private_message => {
				if(!this.isSentByMe(private_message) && !this.tempProcessed.private_messages.has(private_message.private_message.id)){
					Db.check({
						id: private_message.private_message.id
					}, "processedPrivateMessages").then(isPresent => {
						if(!isPresent){
							// not already processed
							this.tempProcessed.private_messages.add(private_message.private_message.id);
							this.onNewPrivateMessage(private_message);
						}
					});
				}
			});
		});
	}
	
	checkForCommentKeywordMention(comment){
		let text = comment.comment.content;
		if(!text) {
			return false;
		}
		let found = false;
		let keywords = [];
		this.keywordsMention.forEach(keyword => {
			if(this.keywordCaseSensitive){
				if(text.includes(keyword)){
					found = true;
					keywords.push(keyword);
				}
			} else {
				if(text.toLowerCase().includes(keyword.toLowerCase())){
					found = true;
					keywords.push(keyword);
				}
			}
		});
		
		if(found) this.onNewCommentKeywordMention(keywords, comment);
		return found;
	}
	
	isSentByMe(x){
		return (x.creator.name == this.loginForm.username_or_email) // TODO use creator.id
	}
	
	checkForPostKeywordMention(post){
		let text = post.post.body;
		if(!text) {
			return false;
		}
		let found = false;
		let keywords = [];
		this.keywordsMention.forEach(keyword => {
			if(this.keywordCaseSensitive){
				if(text.includes(keyword)){
					found = true;
					keywords.push(keyword);
				}
			} else {
				if(text.toLowerCase().includes(keyword.toLowerCase())){
					found = true;
					keywords.push(keyword);
				}
			}
		});
		
		if(found) this.onNewPostKeywordMention(keywords, post);
		return found;
	}
	
	refresh(){
		console.log("fetching...")
		this.refreshComments();
		this.refreshPosts();
		this.refreshMentions();
		this.refreshPrivateMessages();
	}
	
	
	
	// useful function made simpler
	replyToComment(comment, content){
		const post_id = comment.post.id;
		const parent_id = comment.comment.id;
		this.createComment({
			post_id: post_id,
			parent_id: parent_id,
			content: content
		});
		console.log("Replied to comment ID", parent_id, "on post ID", post_id);
	}
	
	replyToPost(post, content){
		const post_id = post.post.id;
		this.createComment({
			post_id: post_id,
			content: content
		});
		console.log("Replied to post ID", post_id);
	}
	
	replyToPrivateMessage(private_message, content){
		const recipient_id = private_message.private_message.id;
		this.createPrivateMessage({
			recipient_id: recipient_id,
			content: content
		})
		console.log("Replied to private_message ID", recipient_id);
	}
	
	
	
	
	
	
	
	
	// bare wrapped function
	addAdmin(form){
		form.auth = this.auth;
		this.client.addAdmin(form);
	}
	addModToCommunity(form){
		form.auth = this.auth;
		this.client.addModToCommunity(form);
	}
	approveRegistrationApplication(form){
		form.auth = this.auth;
		this.client.approveRegistrationApplication(form);
	}
	banFromCommunity(form){
		form.auth = this.auth;
		this.client.banFromCommunity(form);
	}
	banPerson(form){
		form.auth = this.auth;
		this.client.banPerson(form);
	}
	blockCommunity(form){
		form.auth = this.auth;
		this.client.blockCommunity(form);
	}
	blockPerson(form){
		form.auth = this.auth;
		this.client.blockPerson(form);
	}
	buildFullUrl(form){
		form.auth = this.auth;
		this.client.buildFullUrl(form);
	}
	changePassword(form){
		form.auth = this.auth;
		this.client.changePassword(form);
	}
	createComment(form){
		form.auth = this.auth;
		this.client.createComment(form);
	}
	createCommentReport(form){
		form.auth = this.auth;
		this.client.createCommentReport(form);
	}
	createCommunity(form){
		form.auth = this.auth;
		this.client.createCommunity(form);
	}
	createPost(form){
		form.auth = this.auth;
		this.client.createPost(form);
	}
	createPostReport(form){
		form.auth = this.auth;
		this.client.createPostReport(form);
	}
	createPrivateMessage(form){
		form.auth = this.auth;
		this.client.createPrivateMessage(form);
	}
	createPrivateMessageReport(form){
		form.auth = this.auth;
		this.client.createPrivateMessageReport(form);
	}
	createSite(form){
		form.auth = this.auth;
		this.client.createSite(form);
	}
	deleteAccount(form){
		form.auth = this.auth;
		this.client.deleteAccount(form);
	}
	deleteComment(form){
		form.auth = this.auth;
		this.client.deleteComment(form);
	}
	deleteCommunity(form){
		form.auth = this.auth;
		this.client.deleteCommunity(form);
	}
	deletePost(form){
		form.auth = this.auth;
		this.client.deletePost(form);
	}
	deletePrivateMessage(form){
		form.auth = this.auth;
		this.client.deletePrivateMessage(form);
	}
	editComment(form){
		form.auth = this.auth;
		this.client.editComment(form);
	}
	editCommunity(form){
		form.auth = this.auth;
		this.client.editCommunity(form);
	}
	editPost(form){
		form.auth = this.auth;
		this.client.editPost(form);
	}
	editPrivateMessage(form){
		form.auth = this.auth;
		this.client.editPrivateMessage(form);
	}
	editSite(form){
		form.auth = this.auth;
		this.client.editSite(form);
	}
	featurePost(form){
		form.auth = this.auth;
		this.client.featurePost(form);
	}
	followCommunity(form){
		form.auth = this.auth;
		this.client.followCommunity(form);
	}
	getBannedPersons(form){
		form.auth = this.auth;
		this.client.getBannedPersons(form);
	}
	getCaptcha(form){
		form.auth = this.auth;
		this.client.getCaptcha(form);
	}
	getComments(form){
		form.auth = this.auth;
		this.client.getComments(form);
	}
	getCommunity(form){
		form.auth = this.auth;
		this.client.getCommunity(form);
	}
	getModlog(form){
		form.auth = this.auth;
		this.client.getModlog(form);
	}
	getPersonDetails(form){
		form.auth = this.auth;
		this.client.getPersonDetails(form);
	}
	getPersonMentions(form){
		form.auth = this.auth;
		this.client.getPersonMentions(form);
	}
	getPost(form){
		form.auth = this.auth;
		this.client.getPost(form);
	}
	getPosts(form){
		form.auth = this.auth;
		this.client.getPosts(form);
	}
	getPrivateMessages(form){
		form.auth = this.auth;
		this.client.getPrivateMessages(form);
	}
	getReplies(form){
		form.auth = this.auth;
		this.client.getReplies(form);
	}
	getReportCount(form){
		form.auth = this.auth;
		this.client.getReportCount(form);
	}
	getSite(form){
		form.auth = this.auth;
		this.client.getSite(form);
	}
	getSiteMetadata(form){
		form.auth = this.auth;
		this.client.getSiteMetadata(form);
	}
	getUnreadCount(form){
		form.auth = this.auth;
		this.client.getUnreadCount(form);
	}
	getUnreadRegistrationApplicationCount(form){
		form.auth = this.auth;
		this.client.getUnreadRegistrationApplicationCount(form);
	}
	leaveAdmin(form){
		form.auth = this.auth;
		this.client.leaveAdmin(form);
	}
	likeComment(form){
		form.auth = this.auth;
		this.client.likeComment(form);
	}
	likePost(form){
		form.auth = this.auth;
		this.client.likePost(form);
	}
	listCommentReports(form){
		form.auth = this.auth;
		this.client.listCommentReports(form);
	}
	listCommunities(form){
		form.auth = this.auth;
		this.client.listCommunities(form);
	}
	listPostReports(form){
		form.auth = this.auth;
		this.client.listPostReports(form);
	}
	listPrivateMessageReports(form){
		form.auth = this.auth;
		this.client.listPrivateMessageReports(form);
	}
	listRegistrationApplications(form){
		form.auth = this.auth;
		this.client.listRegistrationApplications(form);
	}
	lockPost(form){
		form.auth = this.auth;
		this.client.lockPost(form);
	}
	markAllAsRead(form){
		form.auth = this.auth;
		this.client.markAllAsRead(form);
	}
	markCommentReplyAsRead(form){
		form.auth = this.auth;
		this.client.markCommentReplyAsRead(form);
	}
	markPersonMentionAsRead(form){
		form.auth = this.auth;
		this.client.markPersonMentionAsRead(form);
	}
	markPostAsRead(form){
		form.auth = this.auth;
		this.client.markPostAsRead(form);
	}
	markPrivateMessageAsRead(form){
		form.auth = this.auth;
		this.client.markPrivateMessageAsRead(form);
	}
	passwordChange(form){
		form.auth = this.auth;
		this.client.passwordChange(form);
	}
	passwordReset(form){
		form.auth = this.auth;
		this.client.passwordReset(form);
	}
	purgeComment(form){
		form.auth = this.auth;
		this.client.purgeComment(form);
	}
	purgeCommunity(form){
		form.auth = this.auth;
		this.client.purgeCommunity(form);
	}
	purgePerson(form){
		form.auth = this.auth;
		this.client.purgePerson(form);
	}
	purgePost(form){
		form.auth = this.auth;
		this.client.purgePost(form);
	}
	register(form){
		form.auth = this.auth;
		this.client.register(form);
	}
	removeComment(form){
		form.auth = this.auth;
		this.client.removeComment(form);
	}
	removeCommunity(form){
		form.auth = this.auth;
		this.client.removeCommunity(form);
	}
	removePost(form){
		form.auth = this.auth;
		this.client.removePost(form);
	}
	resolveCommentReport(form){
		form.auth = this.auth;
		this.client.resolveCommentReport(form);
	}
	resolveObject(form){
		form.auth = this.auth;
		this.client.resolveObject(form);
	}
	resolvePostReport(form){
		form.auth = this.auth;
		this.client.resolvePostReport(form);
	}
	resolvePrivateMessageReport(form){
		form.auth = this.auth;
		this.client.resolvePrivateMessageReport(form);
	}
	saveComment(form){
		form.auth = this.auth;
		this.client.saveComment(form);
	}
	savePost(form){
		form.auth = this.auth;
		this.client.savePost(form);
	}
	saveUserSettings(form){
		form.auth = this.auth;
		this.client.saveUserSettings(form);
	}
	search(form){
		form.auth = this.auth;
		this.client.search(form);
	}
	transferCommunity(form){
		form.auth = this.auth;
		this.client.transferCommunity(form);
	}
	verifyEmail(form){
		form.auth = this.auth;
		this.client.verifyEmail(form);
	}
	wrapper(form){
		form.auth = this.auth;
		this.client.wrapper(form);
	}
}