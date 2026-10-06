package com.umrah.api.security;

import com.umrah.api.model.User;
import com.umrah.api.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Custom UserDetailsService implementation loading user records from MongoDB via UserRepository.
 */
@Service
public class UserDetailsServiceImpl implements UserDetailsService {

    @Autowired
    private UserRepository userRepository;

    @Override
    @Transactional
    public UserDetails loadUserByUsername(String emailOrPhone) throws UsernameNotFoundException {
        User user = userRepository.findByEmailOrPhone(emailOrPhone, emailOrPhone)
                .orElseGet(() -> userRepository.findByEmail(emailOrPhone)
                .orElseThrow(() -> new UsernameNotFoundException("User not found with email or phone: " + emailOrPhone)));

        return UserDetailsImpl.build(user);
    }
}
