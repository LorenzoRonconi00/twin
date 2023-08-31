import { currentProfile } from "@/lib/current-profile";
import { db } from "@/lib/db";
import { MemberRole } from "@prisma/client";
import { NextResponse } from "next/server";

export async function DELETE(
    req: Request,
    {params}: {params: {channelId: string}}
) {
    try {
        const profile = await currentProfile();
        const {searchParams} = new URL(req.url);

        const serverId = searchParams.get("serverId");

        if(!profile){
            return new NextResponse("Autorizzazione negata", {status: 401});
        }

        if(!serverId){
            return new NextResponse("ID Server mancante", {status: 400});
        }

        if(!params.channelId){
            return new NextResponse("ID Canale mancante", {status: 400});
        }

        const server = await db.server.update({
            where: {
                id: serverId,
                members: {
                    some: {
                        profileId: profile.id,
                        role: {
                            in: [MemberRole.ADMIN, MemberRole.MODERATOR],
                        }
                    }
                }
            },
            data: {
                channels: {
                    delete: {
                        id: params.channelId,
                        name: {
                            not: "generale",
                        }
                    }
                }
            }
        });

        return NextResponse.json(server);
    } catch (error) {
        console.log("[CHANNEL_ID_DELETE", error);
        return new NextResponse("Errore interno", {status: 500});
    }
}

export async function PATCH(
    req: Request,
    {params}: {params: {channelId: string}}
) {
    try {
        const profile = await currentProfile();
        const {name, type} = await req.json();
        const {searchParams} = new URL(req.url);

        const serverId = searchParams.get("serverId");

        if(!profile){
            return new NextResponse("Autorizzazione negata", {status: 401});
        }

        if(!serverId){
            return new NextResponse("ID Server mancante", {status: 400});
        }

        if(!params.channelId){
            return new NextResponse("ID Canale mancante", {status: 400});
        }

        if(name === "generale"){
            return new NextResponse("Il nome non puó essere 'generale'", {status: 400});
        }

        const server = await db.server.update({
            where: {
                id: serverId,
                members: {
                    some: {
                        profileId: profile.id,
                        role: {
                            in: [MemberRole.ADMIN, MemberRole.MODERATOR],
                        }
                    }
                }
            },
            data: {
                channels: {
                    update: {
                        where: {
                            id: params.channelId,
                            NOT: {
                                name: "generale",
                            },
                        },
                        data: {
                            name,
                            type,
                        }
                    }
                }
            }
        });

        return NextResponse.json(server);
    } catch (error) {
        console.log("[CHANNEL_ID_PATCH", error);
        return new NextResponse("Errore interno", {status: 500});
    }
}