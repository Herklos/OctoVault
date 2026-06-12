/**
 * Re-exports the shared octospaces-sdk space membership implementation.
 *
 * Public spaces are gone; all access is per-node (access:'public'|'space'|'invite').
 * New space/node invite APIs: createSpaceInviteLink, joinSpaceByLink,
 * createNodeInviteLink, joinNodeByLink, inviteToNode, acceptNodeInvite.
 */
export {
  makeJoinRequest,
  inviteToSpace,
  acceptSpaceInvite,
  encodeSpaceInviteLink,
  decodeSpaceInviteLink,
  createSpaceInviteLink,
  joinSpaceByLink,
  recoverSpaceAccess,
  addDeviceToSpaceKeyring,
} from '@drakkar.software/octospaces-sdk';
export type { JoinRequest, SpaceInviteLinkToken } from '@drakkar.software/octospaces-sdk';

// Node-level membership (new in octospaces 0.4.x)
export {
  createNode,
  setNodeAccess,
  inviteToNode,
  acceptNodeInvite,
  createNodeInviteLink,
  decodeNodeInviteLink,
  encodeNodeInviteLink,
  joinNodeByLink,
} from '@drakkar.software/octospaces-sdk';
export type { CreateNodeInput, NodeInviteBundle, NodeInviteLinkToken } from '@drakkar.software/octospaces-sdk';
