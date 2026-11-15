import React,{useEffect,useState} from 'react';
import {OnboardingHelp} from '../onboarding';
import {api,type EntitlementsResponse} from '../api';
import MembershipStatusCard from '../components/MembershipStatusCard';
import BillingHistoryCard from '../components/BillingHistoryCard';
import {Link} from '../components/PreviewNavigation';
import {useAuth} from '../AuthContext';
import {getCachedEntitlements} from '../membershipCache';
import TelegramSettings from '../components/telegram/TelegramSettings';
export default function Account(){
 const {user}=useAuth();const [entitlement,setEntitlement]=useState<EntitlementsResponse|null>(null);
 useEffect(()=>{let alive=true;setEntitlement(null);if(user)void getCachedEntitlements(user.id,api.getEntitlements).then(e=>{if(alive)setEntitlement(e);}).catch(()=>{});return()=>{alive=false;};},[user?.id]);
 return <main className="mx-auto max-w-2xl min-w-0 space-y-5"><section><p className="font-mono text-xs text-natural-sage">Settings</p><h1 className="mt-1 text-3xl font-bold">Your reading delivery</h1></section>{user&&<TelegramSettings key={user.id} owner={user.id}/>} {entitlement&&<><MembershipStatusCard data={entitlement}/><Link to="/pricing">Explore membership</Link></>}<BillingHistoryCard/><OnboardingHelp/></main>;
}
