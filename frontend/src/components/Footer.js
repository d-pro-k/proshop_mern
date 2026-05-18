import React from 'react'
import { Container, Row, Col } from 'react-bootstrap'
import s from './Footer.module.css'

const Footer = () => {
  return (
    <footer className={s.footer}>
      <Container>
        <Row>
          <Col className='text-center py-3'>Copyright &copy; ProShop</Col>
        </Row>
      </Container>
    </footer>
  )
}

export default Footer
