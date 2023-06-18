import { LemmyHttp } from 'lemmy-js-client';
import Db from "./db.js"

export class LemmyJSBot{
	constructor(p){
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
		this.client = new LemmyHttp('https://' + this.instance); // todo perhaps check if instance is defined
		this.tempProcessed = new Set();
		this.newComments = [];
		this.newPosts = [];
		this.newMentions = [];
		this.newKeywordsMention = [];
		this.newPrivateMessage = [];
		this.auth = undefined;
	}
	
	jDebug(...args){
		if(this.debug){
			console.log(...args);
		}
	}

	async login(){
		let loginResult = await this.client.login(this.loginForm);
		if(loginResult){
			this.auth = loginResult.jwt;
			return true;
		} else {
			return false;
		}
	}
	
	preventReprocess(x){
		if(x.comment){
			Db.addKey("id", x.comment.id, "processedComments")
		} else if(x.post){
			Db.addKey("id", x.post.id, "processedPosts")
		} else {
			// TODO get the type and then add
			console.error("not supported atm")
		}
	}
	
	allowReprocess(x){
		if(x.comment){
			Db.removeKey("id", x.comment.id, "processedComments")
		} else if(x.post){
			Db.removeKey("id", x.post.id, "processedPosts")
		} else {
			// TODO get the type and then add
			console.error("not supported atm")
		}
	}
	
	start(){
		this.fetchProcess = setInterval(() => this.refresh(), this.refreshInterval);
	}
	
	stop(){
		// TODO
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
				if(!this.tempProcessed.has(comment.comment.id)){
					let x = Db.isKeyPresent("id", comment.comment.id, "processedComments").then(isPresent => {
						if(!isPresent){
							// not already processed
							//this.newComments.push(comment);
							this.tempProcessed.add(comment.comment.id);
							this.onNewComment(comment)
						}
					}).catch(err => {
						this.jDebug("error:", err)
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
				if(!this.tempProcessed.has(post.post.id)){
					Db.isKeyPresent("id", post.post.id, "processedPosts").then(isPresent => {
						if(!isPresent){
							// not already processed
							this.tempProcessed.add(post.post.id);
							this.onNewPost(post)
						}
					});
				}
			});
		});
	}
	
	refreshMentions(){
		this.client.getPersonMentions({
			auth: this.auth,
			sort: this.mentionsOptions.sort,
			limit: this.mentionsOptions.limit,
			unread_only: this.mentionsOptions.unread_only,
		}).then(res => {
			res.mentions.forEach(mention => {
				if(!this.tempProcessed.has(mention.comment.id)){ // is this the correct way? perhaps I should concatenate mention.post and mention.comment IDs' ?
					Db.isKeyPresent("id", mention.comment.id, "processedMentions").then(isPresent => {
						if(!isPresent){
							// not already processed
							this.tempProcessed.add(mention.comment.id);
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
				if(!this.tempProcessed.has(private_message.private_message.id)){
					Db.isKeyPresent("id", private_message.private_message.id, "processedPrivateMessages").then(isPresent => {
						if(!isPresent){
							// not already processed
							this.tempProcessed.add(private_message.private_message.id);
							this.onNewPrivateMessage(private_message);
						}
					});
				}
			});
		});
	}
	
	checkForCommentKeywordMention(comment){
		let text = comment.comment.content;
		this.keywordsMention.forEach(keyword => {
			if(this.keywordCaseSensitive){
				if(text.includes(keyword)){
					onNewCommentKeywordMention(keyword, comment);
				}
			} else {
				if(text.toLowerCase().includes(keyword.toLowerCase())){
					onNewCommentKeywordMention(keyword, comment);
				}
			}
		});
	}
	
	checkForPostKeywordMention(post){
		let text = post.post.content;
		this.keywordsMention.forEach(keyword => {
			if(this.keywordCaseSensitive){
				if(text.includes(keyword)){
					onNewPostKeywordMention(keyword, comment);
				}
			} else {
				if(text.toLowerCase().includes(keyword.toLowerCase())){
					onNewPostKeywordMention(keyword, comment);
				}
			}
		});
	}
	
	refresh(){
		this.jDebug("fetching...")
		
		this.refreshComments();
		this.refreshPosts();
		this.refreshMentions();
		this.refreshPrivateMessages();
	}
}