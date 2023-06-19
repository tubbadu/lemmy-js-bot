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
	
	onNewComment: (comment) => {
		console.log("comment! ", comment.comment.id)
		bot.preventReprocess(comment)
	},
	onNewPost: (post) => {
		console.log("post! ", post.post.id)
		bot.preventReprocess(post)
	},
	//keywordsMention: ["reddit_bot_linker"],
	onNewCommentKeywordMention: (keyword, comment) => {
		console.log("comment keyword!", comment)
		bot.preventReprocess(comment)
	},
	onNewPostKeywordMention: (keyword, post) => {
		console.log("post keyword!", post)
		bot.preventReprocess(post)
	},
	onNewMention: (mention) => {
		console.log("mention!", mention)
		bot.replyToMention(mention, "you mentioned me");
		bot.preventReprocess(mention);
	},
	onNewPrivateMessage: (message) => {
		console.log("new message!", message)
		bot.replyToPrivateMessage(message, "sorry I made a mess with the API");
		bot.preventReprocess(message)
	}
});

if(await bot.login()){
	console.log("Successfully logged in.");
}
bot.start();



function onNewPost(post){
	//console.log(post.post.name)
	//bot.preventReprocess(post)
}