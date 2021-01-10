const { executionAsyncResource } = require('async_hooks');
const Discord = require('discord.js');
const ytdl = require('ytdl-core');

const { YTSearcher } = require('ytsearcher');

const searcher = new YTSearcher({
    key: process.env.youtubeapi,
    revealed: true
});

const client = new Discord.Client();

const queue = new Map();

client.on("ready", () => {
    console.log("I am online!")
})

client.on("message", async (message) => {
    const prefix = process.env.prefix;
    if(!message.content.startsWith(prefix)) return

    const serverQueue = queue.get(message.guild.id);

    const args = message.content.slice(prefix.length).trim().split(/ +/g)
    const command = args.shift().toLowerCase();

    switch (command) {
        case 'play':
            execute(message, serverQueue);
            break;
        case 'stop':
            stop(message, serverQueue);
            break;
        case 'skip':
            skip(message, serverQueue);
            break;
        case 'pause':
            pause(serverQueue);
            break;
        case 'resume':
            resume(serverQueue);
            break;
        case 'queue':
            Queue(serverQueue);
            break;
    }

    async function execute(message, serverQueue) {
        if(args.length <= 0) 
            return message.channel.send("Please write the name of the song")
        let vc = message.member.voice.channel;
        if (!vc) {
            return message.channel.send("Please join a voice chat first");
        } else {
            let result = await searcher.search(args.join(" "), { type: "video" })
            const songInfo = await ytdl.getInfo(result.first.url)

            let song = {
                title: songInfo.videoDetails.title,
                url: songInfo.videoDetails.video_url
            };

            if (!serverQueue) {
                const queueConstructor = {
                    txtChannel: message.channel,
                    vChannel: vc,
                    connection: null,
                    songs: [],
                    volume: 10,
                    playing: true
                };
                queue.set(message.guild.id, queueConstructor);

                queueConstructor.songs.push(song);

                try {
                    let connection = await vc.join();
                    queueConstructor.connection = connection;
                    play(message.guild, queueConstructor.songs[0]);
                } catch (err) {
                    console.error(err);
                    queue.delete(message.guild.id);
                    return message.channel.send(`Unable to join the voice chat ${err}`)
                }
            } else {
                serverQueue.songs.push(song);
                return message.channel.send(`The song has been added ${song.url}`);
            }
        }
    }
    function play(guild, song) {
        const serverQueue = queue.get(guild.id);
        if (!song) {
            serverQueue.vChannel.leave();
            queue.delete(guild.id);
            return;
        }
        const dispatcher = serverQueue.connection
            .play(ytdl(song.url))
            .on('finish', () => {
                serverQueue.songs.shift();
                play(guild, serverQueue.songs[0]);
            })
        serverQueue.txtChannel.send(`Now playing ${serverQueue.songs[0].url}`)
    }
    function stop(message, serverQueue) {
        if (!message.member.voice.channel)
            return message.channel.send("You need to join the voice chat first!")
        serverQueue.songs = [];
        serverQueue.connection.dispatcher.end();
    }
    function skip(message, serverQueue) {
        if (!message.member.voice.channel)
            return message.channel.send("You need to join the voice chat first");
        if (!serverQueue)
            return message.channel.send("There is nothing to skip!");
        serverQueue.connection.dispatcher.end();
    }
    function pause(serverQueue) {
        if (!serverQueue.connection)
            return message.channel.send("There is no music currently playing!");
        if (!message.member.voice.channel)
            return message.channel.send("You are not in the voice channel!")
        if (serverQueue.connection.dispatcher.paused)
            return message.channel.send("The song is already paused");
        serverQueue.connection.dispatcher.pause();
        message.channel.send("The song has been paused!");
    }
    function resume(serverQueue) {
        if (!serverQueue.connection)
            return message.channel.send("There is no music currently playing!");
        if (!message.member.voice.channel)
            return message.channel.send("You are not in the voice channel!")
        if (serverQueue.connection.dispatcher.resumed)
            return message.channel.send("The song is already playing!");
        serverQueue.connection.dispatcher.resume();
        message.channel.send("The song has been resumed!");
    }

function Queue(serverQueue) {
    if (!serverQueue.connection)
        return message.channel.send("There is no music currently playing!");
    if (!message.member.voice.channel)
        return message.channel.send("You are not in the voice channel!")

    let nowPlaying = serverQueue.songs[0];
    let qMsg = `Now playing: ${nowPlaying.title}\n--------------------------\n`

    for (var i = 1; i < serverQueue.songs.length; i++) {
        qMsg += `${i}. ${serverQueue.songs[i].title}\n`
    }

    message.channel.send('```' + qMsg + 'Requested by: ' + message.author.username + '```');
}
})

client.login(process.env.TOKEN)
