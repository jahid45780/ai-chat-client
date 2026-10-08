export interface User{id:string;name:string;email:string;avatar?:string;role:'USER'|'ADMIN';createdAt?:string;}
export interface Conversation{_id:string;title:string;model:string;createdAt:string;updatedAt:string;}
export interface Message{_id:string;conversation:string;role:'user'|'assistant'|'system';content:string;createdAt:string;model?:string;}
export interface ApiResult<T>{success:boolean;message:string;data:T;}
