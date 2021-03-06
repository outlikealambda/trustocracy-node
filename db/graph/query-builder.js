
const rel = require('./relationships.js');

const queryBuilder = {

  user: id => {
    return `MATCH (u:Person {id:${id}})
            RETURN u`;
  },

  // returns [ user, [emails], [neighbors: {user, relationship}] ]
  // speed: unknown, possibly unimportant
  userInfo: id => {
    return `MATCH (u:Person)-[${rel.personEmail.hasEmail}]->(e:Email)
            WHERE u.id = ${id}
            WITH u, collect(e.email) as emails
            OPTIONAL MATCH (u)-[r]->(f:Person)
            RETURN u as user, emails, collect({friend: f, relationship: type(r)}) as neighbors`;
  },

  getUserInfoWithLocations: id => {
    return `MATCH (u:Person)-[${rel.personEmail.hasEmail}]->(e:Email)
            WHERE u.id = ${id}
            WITH u as user, collect(e.email) as emails
            RETURN user, emails`;
  },

  userByEmail: email => {
    return `MATCH (e:Email)<-[${rel.personEmail.hasEmail}]-(u:Person)
            WHERE e.email = '${email}'
            RETURN u`;
  },

  emailsInGraph: emails => {
    return `MATCH (e:Email)<-[${rel.personEmail.hasEmail}]-(n)
            WHERE e.email IN [${wrapEmailsInQuotes(emails).join(', ')}]
            RETURN e`;
  },

  addEmailsToGraph: emails => {
    return 'CREATE ' +
      emails
        .map(email => `(:Contact)-[${rel.personEmail.hasEmail}]->(:Email{email:'${email}'})`)
        .join(', ');
  },

  // user by location
  userByLocation: locationId => {
    return `MATCH (z:Location {id: ${locationId}})<-[]-(p:Person)
            RETURN p`;
  },

  // parameters user id
  // returns [Locations: [Country, City, Postal]]
  locationByUserId: userId => {
    return `MATCH ((p:Person)-[:CONSTITUENT_OF]->(l:Location)-[:POSTAL]->(postal:Postal))
            MATCH ((p:Person)-[:CONSTITUENT_OF]->(l:Location)-[:CITY]->(city:City))
            MATCH ((p:Person)-[:CONSTITUENT_OF]->(l:Location)-[:COUNTRY]->(country:Country))
            WHERE p.id = ${userId}
            RETURN l, country, city, postal`;
  },

  /*
  this method creates 4 relationships given a userId and
  location, country, city, and postal names
  relationships:
  CONSTITUENT_OF
  POSTAL
  CITY
  COUNTRY
  */
  connectUserToLocation: (userId, locationId, locationName, country, city, postal) => {
    return `MERGE (co:Country {name:"${country}"})
            MERGE (ci:City {name:"${city}"})
            MERGE (po:Postal {name:"${postal}"})
            WITH co, ci, po
            MATCH (p:Person {id : ${userId}})
            CREATE (p)-[${rel.personLocation.constituentOf}]->(l:Location {id: ${locationId}, name: "${locationName}"})
            MERGE (l)-[${rel.locationRel.country}]->(co)
            MERGE (l)-[${rel.locationRel.city}]->(ci)
            MERGE (l)-[${rel.locationRel.postalCode}]->(po)
            RETURN l,co,ci,po`;
  },

  // this method removes a location node and all of its relationships
  removeLocation: (locationId) => {
    return `MATCH (l:Location)<-[cf:CONSTITUENT_OF]-(p:Person)
            WHERE l.id =${locationId}
            DELETE cf
            WITH l
            MATCH (l:Location)-[po:POSTAL]->(:Postal)
            MATCH (l:Location)-[ci:CITY]->(:City)
            MATCH (l:Location)-[co:COUNTRY]->(:Country)
            DELETE po,ci,co,l;`;
  },

  // adds a :KNOWS relationship to all people (users/contacts) who aren't
  // already related to userId
  knowAllUnconnectedEmails: (userId, emails) => {
    return `MATCH (u:Person), (e:Email)<-[${rel.personEmail.hasEmail}]-(n)
            WHERE e.email IN [${wrapEmailsInQuotes(emails).join(', ')}] AND u.id = ${userId} AND NOT (u)-->(n)
            CREATE (u)-[${rel.personPerson.knows}]->(n)`;
  },

  fbUser: fbUserId => {
    return `MATCH (u:Person {fbUserId:${fbUserId}})
            RETURN u`;
  },

  gaUser: gaUserId => {
    // google id is too long as an int, so convert it to a string
    return `MATCH (u:Person {gaUserId:'${gaUserId}'})
            RETURN u`;
  },

  nearest: (userId, topicId) => {
    return `MATCH (p:Person)-[fr${rel.personPerson.follows}]->(f:Person)-[rs${rel.personPerson.follows}*0..2]->(ff:Person)-[${rel.personOpinion.opines}]->(o:Opinion)-[:ADDRESSES]->(t:Topic)
            WHERE p.id=${userId} AND t.id=${topicId}
            RETURN type(fr), f, extract(r in rs | type(r)) as extracted, ff, o`;
  },

  connected: (userId, topicId) => {
    return `MATCH (author:Person)-[${rel.personOpinion.opines}]->(o:Opinion)-[:ADDRESSES]->(t:Topic)
            WHERE t.id=${topicId}
            WITH o, author
            MATCH (u:Person)-[fr${rel.personPerson.follows}]->(f:Person)-[rs${rel.personPerson.follows}*0..3]->(author)
            WHERE u.id=${userId}
            OPTIONAL MATCH (o) <-- (q:Qualifications)
            RETURN o, author, COLLECT([type(fr), f, extract(r in rs | type(r))]) as connections, q`;
  },

  connectedOpinions: (userId, topicId) => `CALL friend.author.opinion(${userId}, ${topicId})`,

  friendsAuthors: (userId, topicId) => `CALL friend.author(${userId}, ${topicId})`,

  friends: userId => `CALL friend(${userId})`,

  measureInfluence: (userId, topicId) => `CALL measure.influence(${userId}, ${topicId})`,

  setRanked: (userId, targetIds) => `CALL dirty.ranked.set(${userId}, ${targetIds})`,

  setTarget: (userId, targetId, topicId) => `CALL dirty.target.set(${userId}, ${targetId}, ${topicId})`,

  clearTarget: (userId, topicId) => `CALL dirty.target.clear(${userId}, ${topicId})`,

  authoredOpinion: (authorId, topicId) =>
    `MATCH (author:Person) -[:AUTHORED_${topicId}]-> (o:Opinion) WHERE author.id=${authorId} RETURN o`,

  opinionsByIds: ids => {
    const idList = ids.join();
    return `MATCH (p:Person) --> (o:Opinion)
            WHERE o.id IN [${idList}]
            OPTIONAL MATCH (o) <-- (q:Qualifications)
            RETURN o, p, q`;
  },

  // published only
  opinionsByTopic: topicId => {
    return `MATCH (p:Person) -[:AUTHORED_${topicId}]-> (o:Opinion)
            RETURN o, p`;
  },

  opinionIdsByTopic: topicId => {
    return `MATCH (t:Topic)-[:DISCUSSED_BY]->(o:Opinion)
            WHERE t.id = ${topicId}
            RETURN o.id`;
  },

  opinionById: opinionId => {
    return `MATCH (p:Person) --> (o:Opinion) <-[:DISCUSSED_BY]- (t:Topic)
            WHERE o.id = ${opinionId}
            OPTIONAL MATCH (o) <-[:QUALIFIES]- (q:Qualifications)
            RETURN o, p, t, q`;
  },

  opinionDraftByUserTopic: (userId, topicId) => {
    return `MATCH (p:Person)-[${rel.personOpinion.thinks}]->(o:Opinion)-->(t:Topic)
            WHERE p.id = ${userId} AND t.id = ${topicId}
            OPTIONAL MATCH (o) <-- (q:Qualifications)
            RETURN o, p, q
            ORDER BY o.created DESC
            LIMIT 1`;
  },

  // set details with queryWithParams + { person }
  createUser: () => {
    return `CREATE (p:Person)
            SET
              p = { person }
            RETURN p`;
  },

  upgradeContact: email => {
    return `MATCH (c:Contact)-[${rel.personEmail.hasEmail}]->(e:Email {email: '${email}'})
            REMOVE c:Contact
            SET
              c :Person,
              c = { person }
            `;
  },

  // TODO: pass userId, gaUserId and name as { person }, like upgradeContact above
  // aka: migrate to upgradeContact
  upgradeContactToGaPerson: (userId, gaUserId, name, email) => {
    return `MATCH (c:Contact)-[${rel.personEmail.hasEmail}]->(e:Email {email:'${email}'})
            REMOVE c:Contact
            SET c :Person, c.name = '${name}', c.id = ${userId}, c.gaUserId = '${gaUserId}'
            RETURN c`;
  },

  addEmailToUser: (userId, email) => {
    return `MATCH (u:Person)
            WHERE u.id = ${userId}
            CREATE (u)-[${rel.personEmail.hasEmail}]->(e:Email {email:'${email}'})`;
  },

  // actual opinion and qualifications are passed as params
  // via queryWithParams
  createOpinion: (userId, topicId) => {
    return `MATCH (p:Person), (t:Topic)
            WHERE p.id=${userId} AND t.id=${topicId}
            CREATE
              (p)-[${rel.personOpinion.thinks}]->(o:Opinion)-[${rel.opinionTopic.addresses}]->(t),
              (q:Qualifications)-[:QUALIFIES]->(o)
            SET
              o = { opinion },
              o.created = timestamp(),
              q = { qualifications }
            RETURN o, p, q`;
  },

  publishOpinion: draftId => {
    return `MATCH (p:Person), (o:Opinion)
            WHERE o.draftId=${draftId}
            CREATE (p)-[${rel.personOpinion.opines}]->(o)
            RETURN o.draftId`;
  },

  unpublishOpinion: opinionId => {
    return `MATCH (:Person)-[r${rel.personOpinion.opines}]->(o:Opinion)
            WHERE o.id=${opinionId}
            DELETE r`;
  },

  topic: (topicId) => {
    return `MATCH (t:Topic)-[:DISCUSSED_BY]->(o:Opinion)<-[:AUTHORED_${topicId}]-(:Person)
            RETURN t, count(o) as opinionCount, max(o.created) as lastUpdated`;
  },

  topics: () => {
    return `MATCH (t:Topic)-[:DISCUSSED_BY]->(o:Opinion)<-[]-(:Person)
            RETURN t, count(o) as opinionCount, max(o.created) as lastUpdated`;
  },

  addDelegate: (userId, delegate) =>
    createUserEdge(delegate.relationship)(userId, delegate.id),

  removeDelegate: (userId, delegate) =>
    deleteUserEdge(delegate.relationship)(userId, delegate.id),

  addToPool: createUserEdge('KNOWS'),

  removeFromPool: deleteUserEdge('KNOWS'),

  getPooled: userId =>
    `MATCH (u:Person)-[:KNOWS]->(f:Person)
     WHERE u.id=${userId}
     RETURN f`,

  rankDelegates: (userId, delegateIds) =>
    `CALL dirty.ranked.set(${userId}, ${JSON.stringify(delegateIds)})`
};

function createUserEdge (relationshipName) {
  return (fromUserId, toUserId) =>
    `MATCH (from:Person), (to:Person)
     WHERE from.id = ${fromUserId} AND to.id=${toUserId}
     CREATE (from)-[:${relationshipName}]->(to)`;
}

function deleteUserEdge (relationshipName) {
  return (fromUserId, toUserId) =>
    `MATCH (from:Person)-[r:${relationshipName}]->(to:Person)
     WHERE from.id = ${fromUserId} AND to.id=${toUserId}
     DELETE r`;
}

function wrapEmailsInQuotes (emails) {
  return emails.map(email => `'${email}'`);
}

module.exports = queryBuilder;
