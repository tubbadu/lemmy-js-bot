import {LemmyJSBot} from "./lemmy-js-bot.js";

const LEMMY_USERNAME = process.env.LEMMY_USERNAME;
const LEMMY_PASSWORD = process.env.LEMMY_PASSWORD;
const LEMMY_INSTANCE = process.env.LEMMY_INSTANCE;
const LEMMY_ACTOR_ID = "https://" + LEMMY_INSTANCE + "/u/" + LEMMY_USERNAME


let bot = new LemmyJSBot({
	loginForm: {
		username_or_email: LEMMY_USERNAME,
		password: LEMMY_PASSWORD
	},
	instance: LEMMY_INSTANCE,
	debug: true,
	
	onNewComment: onNewComment,
	onNewPost: onNewPost,
	keywordsMention: ["reddit"],
	onNewCommentKeywordMention: (keyword, comment) => {
		console.log("keyword:", comment.comment.id)
		bot.preventReprocess(comment)
	}
});

if(await bot.login()){
	console.log("Successfully logged in.");
}
bot.start();

function onNewComment(comment){
	console.log("comment: ", comment.comment.id)
	bot.preventReprocess(comment)
}

function onNewPost(post){
	//console.log(post.post.name)
	//bot.preventReprocess(post)
}