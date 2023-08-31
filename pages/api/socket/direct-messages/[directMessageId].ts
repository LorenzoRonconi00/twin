
import { currentProfilePages } from "@/lib/current-profile-pages";
import { NextApiResponseServerIo } from "@/types";
import { NextApiRequest } from "next";
import { db } from "@/lib/db";
import { MemberRole } from "@prisma/client";

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponseServerIo,
) {
    if(req.method !== "DELETE" && req.method !== "PATCH"){
        return res.status(405).json({error: "Metodo non autorizzato"});
    }

    try {
        const profile = await currentProfilePages(req);
        const {directMessageId, conversationId} = req.query;
        const {content} = req.body;

        if(!profile){
            return res.status(401).json({error: "Autorizzazione negata"});
        }

        if(!conversationId){
            return res.status(400).json({error: "ID Conversazione mancante"});
        }

        const conversation = await db.conversation.findFirst({
            where: {
                id: conversationId as string,
                OR: [
                    {
                        memberOne: {
                            profileId: profile.id,
                        }
                    },
                    {
                        memberTwo: {
                            profileId: profile.id,
                        }
                    }
                ]
            },
            include: {
                memberOne: {
                    include: {
                        profile: true,
                    }
                },
                memberTwo: {
                    include: {
                        profile: true,
                    }
                }
            }
        })

        if(!conversation){
            return res.status(404).json({error: "Conversazione non trovata"});
        }

        const member = conversation.memberOne.profileId === profile.id
            ? conversation.memberOne : conversation.memberTwo;

        if(!member){
            return res.status(404).json({error: "Partecipante non trovato"});
        }

        let directMessage = await db.directMessage.findFirst({
            where: {
                id: directMessageId as string,
                conversationId: conversationId as string,
            },
            include: {
                member: {
                    include: {
                        profile: true,
                    }
                }
            }
        })

        if(!directMessage || directMessage.deleted){
            return res.status(404).json({error: "Messaggio non trovato"});
        }

        const isMessageOwner = directMessage.memberId === member.id;
        const isAdmin = member.role === MemberRole.ADMIN;
        const isModerator = member.role === MemberRole.MODERATOR;
        const canModify = isMessageOwner || isAdmin || isModerator;

        if(!canModify){
            return res.status(401).json({error: "Autorizzazione negata"});
        }

        if(req.method === "DELETE"){
            directMessage = await db.directMessage.update({
                where: {
                    id: directMessageId as string,
                },
                data: {
                    fileUrl: null,
                    content: "Questo messaggio é stato eliminato.",
                    deleted: true,
                },
                include: {
                    member: {
                        include: {
                            profile: true,
                        }
                    }
                }
            })
        }

        if(req.method === "PATCH"){
            if(!isMessageOwner){
                return res.status(401).json({error: "Autorizzazione negata"});
            }

            directMessage = await db.directMessage.update({
                where: {
                    id: directMessageId as string,
                },
                data: {
                    content: content,
                },
                include: {
                    member: {
                        include: {
                            profile: true,
                        }
                    }
                }
            })
        }

        const updateKey = `chat:${conversation.id}:messages:update`;

        res?.socket?.server?.io?.emit(updateKey, directMessage);

        return res.status(200).json(directMessage);
    } catch (error) {
        console.log("[MESSAGE_ID]",error);
        return res.status(500).json({error: "Errore interno"});
    }
}