module.exports = {

  questions:
    `SELECT question.* FROM question
      JOIN topic_question
      ON question.id = topic_question.question_id
      WHERE topic_question.topic_id = $<topicId>
    `,

  pickQuestions:
    `SELECT question.* FROM question
      JOIN topic_question
      ON question.id = topic_question.question_id
      WHERE topic_question.topic_id = $<topicId>
      AND question.type = 'PICK'
    `,

  answer : {

    create :
      `INSERT INTO answer(topic_id, opinion_id, user_id, question_id, picked, rated)
       VALUES($<topicId>, $<opinionId>, $<userId>, $<questionId>, $<picked>, $<rated>)
       returning id`,

    update :
      `UPDATE answer
       SET picked = $<picked>, rated = $<rated>
       WHERE answer.id = $<answerId>
       returning id`,

    remove :
      `DELETE FROM answer
       WHERE answer.id = $<answerId>`,

    byUser:
      `SELECT * FROM answer
        WHERE answer.topic_id = $<topicId>
        AND answer.opinion_id = $<opinionId>
        AND answer.user_id = $<userId>
      `
  }
};
