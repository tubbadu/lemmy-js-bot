import { LemmyHttp } from 'lemmy-js-client';
import Db from "./db.js"



function onNewComments(){
	while(newComments.length > 0){
		let comment = newComments.pop();
		console.log(">", comment.comment.id)
		Db.addKey("id", comment.comment.id, "processedComments")
	}
}


export class LemmyJSBot{
	constructor(p){
		this.loginForm = p.loginForm;
		this.instance = p.instance;
		
		this.refreshInterval = this.refreshInterval ?? 5000;
		
		this.onNewComment = p.onNewComment ?? function(){};
		this.onNewPost = p.onNewPost ?? function(){};
		this.onMention = p.onMention ?? function(){};
		this.onKeywordMention = p.onKeywordMention ?? function(){};
		this.keywordsMention = p.keywordsMention ?? [];
		this.onPrivateMessage = p.onPrivateMessage ?? function(){};

		const CommentsOptions = p.commentsOptions ?? {}
		this.commentsOptions = {
			sort: CommentsOptions.sort ?? "New",
			listing: CommentsOptions.listing ?? "All",
			communityFilterName: CommentsOptions.communityFilterName,
			communityFilterID: CommentsOptions.communityFilterID,
			savedOnly: CommentsOptions.savedOnly ?? false,
			limit: CommentsOptions.limit,
		}

		const PostsOptions = p.postsOptions ?? {}
		this.postsOptions = {
			sort: PostsOptions.sort ?? "New",
			listing: PostsOptions.listing ?? "All",
			communityFilterName: PostsOptions.communityFilterName,
			communityFilterID: PostsOptions.communityFilterID,
			savedOnly: PostsOptions.savedOnly ?? false,
			limit: PostsOptions.limit,
		}
		
		this.debug = p.debug ?? false;
		this.client = new LemmyHttp('https://' + this.instance); // todo perhaps check if instance is defined
		this.tempProcessed = new Set();
		this.newComments = [];
		this.newPosts = [];
		this.newMentions = [];
		this.newKeywordsMention = [];
		this.newPrivateMessage = [];
		this.auth = undefined;
		
		this.login()
		this.start()
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
	
	refresh(){
		this.jDebug("fetching...")
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
					Db.isKeyPresent("id", post.post.id, "processedComments").then(isPresent => {
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
}