
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

  opinionsByIds: ids => {
    const idList = ids.join();
    return `MATCH (p:Person) --> (o:Opinion)
            WHERE o.id IN [${idList}]
            OPTIONAL MATCH (o) <-- (q:Qualifications)
            RETURN o, p, q`;
  },

  // published only
  opinionsByTopic: topicId => {
    return `MATCH (p:Person) -[${rel.personOpinion.opines}]-> (o:Opinion) --> (t:Topic)
            WHERE t.id = ${topicId}
            OPTIONAL MATCH (o) <-- (q:Qualifications)
            RETURN o, p, q`;

  },

  opinionById: opinionId => {
    return `MATCH (p:Person) --> (o:Opinion)
            WHERE o.id = ${opinionId}
            OPTIONAL MATCH (o) <-[:QUALIFIES]- (q:Qualifications)
            RETURN o, p, q`;
  },

  opinionDraftByUserTopic: (userId, topicId) => {
    return `MATCH (p:Person)-[${rel.personOpinion.thinks}]->(o:Opinion)-->(t:Topic)
            WHERE p.id = ${userId} AND t.id = ${topicId}
            OPTIONAL MATCH (o) <-- (q:Qualifications)
            RETURN o, p, q
            ORDER BY o.created DESC
            LIMIT 1`;
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

  createFacebookUser: (userId, facebookId, name) => {
    return `CREATE (p:Person {name: '${name}', id: ${userId}, fbUserId: ${facebookId}}) RETURN p`;
  },

  createGoogleUser: (userId, googleId, name) => {
    // google id is too long as an int, so convert it to a string
    return `CREATE (p:Person {name: '${name}', id: ${userId}, gaUserId: '${googleId}'}) RETURN p`;
  },

  upgradeContactToPerson: (userId, gaUserId, name, email) => {
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

  publishOpinion: opinionId => {
    return `MATCH (p:Person)-[${rel.personOpinion.thinks}]->(o:Opinion)
            WHERE o.id=${opinionId}
            CREATE (p)-[${rel.personOpinion.opines}]->(o)
            RETURN o.id`;
  },

  unpublishOpinion: (userId, topicId) => {
    return `MATCH (p:Person)-[r:${rel.personOpinion.opines}]->(:Opinion)-->(t:Topic)
            WHERE p.id=${userId} AND t.id=${topicId}
            DELETE r`;
  },

  topic: (topicId) => {
    return `MATCH (t:Topic)
            WHERE t.id = ${topicId}
            RETURN t`;
  },

  topics: () => {
    return 'MATCH (t:Topic) RETURN t';
  },

  addDelegate: (userId, delegate) => {
    return `MATCH (u:Person), (d:Person)
            WHERE u.id = ${userId} AND d.id = ${delegate.id}
            CREATE (u)-[:${delegate.relationship}]->(d)`;
  },

  removeDelegate: (userId, delegate) => {
    return `MATCH (u:Person)-[r]->(d:Person)
            WHERE u.id = ${userId} AND d.id = ${delegate.id}
            DELETE r`;
  }
};

function wrapEmailsInQuotes(emails) {
  return emails.map(email => `'${email}'`);
}

module.exports = queryBuilder;